#!/usr/bin/env node
/**
 * Read-only lint check for one changed source file, meant for a Kiro file-save/edit hook.
 *
 * Input, in order of precedence:
 *   1. File paths as arguments: `node .kiro/scripts/lint-changed-file.mjs <path> [...]`
 *   2. `--changed`: every changed or untracked file (`git diff --name-only HEAD` + untracked)
 *   3. Hook event JSON on STDIN. The field holding the path isn't documented, so this looks at
 *      file_path / filePath / path / paths (top level and under tool_input), then falls back to
 *      any string value that looks like a repo source path.
 *
 * Only existing .ts/.tsx/.js/.mjs/.cjs files under apps/, packages/, services/, or
 * infrastructure/ are checked (not node_modules, dist, build, cdk.out, coverage, generated).
 * Runs `pnpm exec eslint --no-warn-ignored <files>` and `pnpm exec prettier --check <files>`.
 * It never writes, formats, or deletes files, so it can't retrigger a file-save hook.
 *
 * Exit 0: nothing to check, all checks passed, or the checks couldn't run (reported as SKIPPED,
 * so the hook never fails for tooling reasons). Exit 1: ESLint or Prettier reported problems.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const STDIN_TIMEOUT_MS = 2000;
const CHECK_TIMEOUT_MS = 60_000;
const SOURCE_EXT = /\.(?:ts|tsx|js|mjs|cjs)$/;
const SOURCE_ROOT = /^(?:apps|packages|services|infrastructure)\//;
const EXCLUDED_SEGMENT =
  /(?:^|\/)(?:node_modules|dist|build|cdk\.out|coverage|generated|playwright-report|test-results)\//;
const SAFE_PATH = /^[A-Za-z0-9_./@-]+$/;
const PATH_KEYS = ['file_path', 'filePath', 'path', 'paths', 'file', 'files'];
// An optional absolute prefix, then a repo source root. Absolute matches are made relative later.
const PATH_LIKE =
  /(?:\/[^\s"'`<>|]*\/)?\b(?:apps|packages|services|infrastructure)\/[^\s"'`<>|]+\.(?:ts|tsx|js|mjs|cjs)\b/g;

const out = (msg) => process.stdout.write(`${msg}\n`);
const err = (msg) => process.stderr.write(`${msg}\n`);

/** Read STDIN without blocking forever when nothing is piped. */
function readStdin() {
  if (process.stdin.isTTY) return Promise.resolve('');
  return new Promise((done) => {
    const chunks = [];
    const timer = setTimeout(() => {
      process.stdin.destroy();
      done(Buffer.concat(chunks).toString('utf8'));
    }, STDIN_TIMEOUT_MS);
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => {
      clearTimeout(timer);
      done(Buffer.concat(chunks).toString('utf8'));
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      done('');
    });
  });
}

/** Collect candidate paths from a hook event of unknown shape. */
function pathsFromEvent(event) {
  const found = [];
  const take = (v) => {
    if (typeof v === 'string') found.push(v);
    else if (Array.isArray(v)) v.forEach(take);
  };
  for (const obj of [event, event?.tool_input, event?.toolInput]) {
    if (obj && typeof obj === 'object') for (const k of PATH_KEYS) take(obj[k]);
  }
  if (found.length > 0) return found;
  // Fallback: scan every string value (bounded depth) for repo-looking source paths.
  const scan = (v, depth) => {
    if (depth > 6 || v === null || v === undefined) return;
    if (typeof v === 'string') {
      for (const m of v.matchAll(PATH_LIKE)) found.push(m[0]);
    } else if (typeof v === 'object') {
      for (const x of Object.values(v)) scan(x, depth + 1);
    }
  };
  scan(event, 0);
  return found;
}

function changedFiles() {
  try {
    const git = (args) =>
      execFileSync('git', args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .split('\0')
        .filter(Boolean);
    return [
      ...git(['diff', '--name-only', '-z', 'HEAD']),
      ...git(['ls-files', '--others', '--exclude-standard', '-z']),
    ];
  } catch {
    return [];
  }
}

/** Repo-relative POSIX path, or null when outside the repo. */
function toRepoPath(p, base) {
  const abs = isAbsolute(p) ? p : resolve(base, p);
  const rel = relative(ROOT, abs).split('\\').join('/');
  return rel === '' || rel.startsWith('..') || isAbsolute(rel) ? null : rel;
}

function lintable(rel) {
  if (!SOURCE_ROOT.test(rel) || !SOURCE_EXT.test(rel) || EXCLUDED_SEGMENT.test(rel)) return false;
  if (!SAFE_PATH.test(rel)) {
    err(`lint-changed-file: skipped a path with unusual characters: ${JSON.stringify(rel)}`);
    return false;
  }
  try {
    return existsSync(resolve(ROOT, rel)) && statSync(resolve(ROOT, rel)).isFile();
  } catch {
    return false;
  }
}

/** Run a read-only check. Returns 'pass' | 'fail' | 'skipped'. */
function run(label, args) {
  const win = process.platform === 'win32';
  const res = spawnSync(win ? 'pnpm.cmd' : 'pnpm', args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: CHECK_TIMEOUT_MS,
    shell: win, // .cmd needs a shell on Windows; arguments are SAFE_PATH-validated above.
  });
  if (res.error) {
    const why = res.error.code === 'ETIMEDOUT' ? 'timed out' : `could not run (${res.error.code})`;
    err(`lint-changed-file: SKIPPED ${label}: ${why}. Run manually: pnpm ${args.join(' ')}`);
    return 'skipped';
  }
  if (res.status === 0) return 'pass';
  err(`lint-changed-file: ${label} found problems:`);
  err(`${res.stdout ?? ''}${res.stderr ?? ''}`.trim());
  return 'fail';
}

const argv = process.argv.slice(2);
let candidates = [];
let base = ROOT;
if (argv.includes('--changed')) {
  candidates = changedFiles();
} else if (argv.length > 0) {
  candidates = argv;
  base = process.cwd();
} else {
  const raw = (await readStdin()).trim();
  if (raw !== '') {
    try {
      const event = JSON.parse(raw);
      candidates = pathsFromEvent(event);
      if (typeof event?.cwd === 'string' && isAbsolute(event.cwd)) base = event.cwd;
    } catch {
      out('lint-changed-file: hook input was not valid JSON; skipped.');
      process.exit(0);
    }
  }
}

const files = [
  ...new Set(
    candidates
      .map((p) => toRepoPath(String(p), base))
      .filter((p) => p !== null)
      .filter(lintable),
  ),
];
if (files.length === 0) {
  out('lint-changed-file: no lintable source files changed; skipped.');
  process.exit(0);
}

const eslint = run('eslint', ['exec', 'eslint', '--no-warn-ignored', ...files]);
const prettier = run('prettier', ['exec', 'prettier', '--check', ...files]);
const failed = eslint === 'fail' || prettier === 'fail';
out(`lint-changed-file: ${files.length} file(s); eslint ${eslint}, prettier ${prettier}.`);
if (failed) err('Fix manually, or format only these files: pnpm exec prettier --write <files>');
process.exit(failed ? 1 : 0);

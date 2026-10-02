#!/usr/bin/env node
/**
 * Offline evaluator regression check, meant for a Kiro task-completion hook.
 *
 * By default it runs only when evaluation-relevant files changed, matching the code paths in
 * `.kiro/steering/evaluation.md`. "Changed" means uncommitted (`git diff --name-only HEAD`),
 * untracked, or committed on this branch since develop (`git diff --name-only develop...HEAD`,
 * falling back to `origin/develop`, then to uncommitted + untracked only). The branch range
 * keeps the check useful after the commit-on-finish flow in `git-workflow.md`.
 * Docs and spec files in that list don't affect tests, so they don't trigger a run.
 * Otherwise it prints a skip message and exits 0. `--force` runs the suites regardless.
 * `--if-changed` is accepted as the default.
 *
 * Runs only the relevant Vitest files, not the full suite:
 *   shared: src/scoring src/grounding src/keywords src/tailoring src/properties.test.ts
 *           src/fixtures src/schemas
 *   api:    src/eval/evaluate.test.ts src/services/evidenceMapBuilder.test.ts
 *           src/ai/prompts/analyze.test.ts
 * `RUN_BEDROCK_EVAL` is removed from the child environment, so the billable live evaluation
 * (`analyzePrompt.live.test.ts`) never runs from here.
 *
 * Read-only: it writes no repo files. Vitest may update its cache under node_modules/.vite,
 * as `pnpm test` does. Exit status: 0 when skipped or all suites pass, otherwise the first
 * non-zero suite status. If pnpm can't be started, it reports SKIPPED and exits 0.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SUITE_TIMEOUT_MS = 5 * 60_000;
/** Base refs for branch changes, tried in order (feature/* branches PR into develop). */
const BASE_REFS = ['develop', 'origin/develop'];

/** Evaluation code paths (keep in sync with evaluation.md's fileMatchPattern). */
const EVAL_PATHS = [
  /^packages\/shared\/src\/(?:scoring|grounding|keywords|tailoring|fixtures\/demo)\//,
  /^packages\/shared\/src\/properties\.test\.ts$/,
  /^packages\/shared\/src\/limits\.ts$/,
  /^packages\/shared\/src\/test\/arbitraries\.ts$/,
  /^packages\/shared\/src\/schemas\/(?:evidenceMap|modelOutputs)\.ts$/,
  /^services\/api\/src\/eval\//,
  /^services\/api\/src\/services\/evidenceMapBuilder[^/]*\.ts$/,
  /^services\/api\/src\/ai\/prompts\/analyze[^/]*\.ts$/,
];

const SUITES = [
  {
    name: 'shared',
    args: [
      '--filter',
      '@proof-and-poise/shared',
      'exec',
      'vitest',
      'run',
      'src/scoring',
      'src/grounding',
      'src/keywords',
      'src/tailoring',
      'src/properties.test.ts',
      'src/fixtures',
      'src/schemas',
    ],
  },
  {
    name: 'api',
    args: [
      '--filter',
      '@proof-and-poise/api',
      'exec',
      'vitest',
      'run',
      'src/eval/evaluate.test.ts',
      'src/services/evidenceMapBuilder.test.ts',
      'src/ai/prompts/analyze.test.ts',
    ],
  },
];

const out = (msg) => process.stdout.write(`${msg}\n`);
const err = (msg) => process.stderr.write(`${msg}\n`);

const git = (args) =>
  execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .split('\0')
    .filter(Boolean);

/**
 * Files committed on this branch since it left develop (`git diff <base>...HEAD`), so the
 * check still runs after the commit-on-finish flow in git-workflow.md. Empty when no base
 * resolves (then only uncommitted and untracked changes count).
 */
function branchFiles() {
  for (const base of BASE_REFS) {
    try {
      return git(['diff', '--name-only', '-z', `${base}...HEAD`]);
    } catch {
      // Try the next base ref.
    }
  }
  return [];
}

/** Branch + uncommitted + untracked repo paths, or null when git isn't usable. */
function changedFiles() {
  try {
    return [
      ...git(['diff', '--name-only', '-z', 'HEAD']),
      ...git(['ls-files', '--others', '--exclude-standard', '-z']),
      ...branchFiles(),
    ];
  } catch {
    return null;
  }
}

if (!process.argv.includes('--force')) {
  const changed = changedFiles();
  if (changed === null) {
    out('eval-regression: git unavailable; running the suites anyway.');
  } else {
    const relevant = changed.filter((f) => EVAL_PATHS.some((re) => re.test(f)));
    if (relevant.length === 0) {
      out('eval-regression: no evaluator files changed; skipped.');
      process.exit(0);
    }
    out(`eval-regression: ${relevant.length} evaluator file(s) changed; running offline suites.`);
  }
}

const env = { ...process.env };
delete env.RUN_BEDROCK_EVAL;
const win = process.platform === 'win32';
const results = [];
for (const suite of SUITES) {
  out(`eval-regression: pnpm ${suite.args.join(' ')}`);
  const res = spawnSync(win ? 'pnpm.cmd' : 'pnpm', suite.args, {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
    timeout: SUITE_TIMEOUT_MS,
    shell: win, // .cmd needs a shell on Windows; arguments are fixed constants.
  });
  if (res.error) {
    const timedOut = res.error.code === 'ETIMEDOUT';
    // A timeout is a real failure; a missing pnpm is a tooling gap, reported but not failed.
    err(
      timedOut
        ? `eval-regression: ${suite.name} timed out after ${SUITE_TIMEOUT_MS / 1000} s.`
        : `eval-regression: SKIPPED ${suite.name}: could not run (${res.error.code}). Run manually: pnpm ${suite.args.join(' ')}`,
    );
    results.push({ name: suite.name, status: timedOut ? 1 : null });
    continue;
  }
  results.push({ name: suite.name, status: res.status ?? 1 });
}

out(
  `eval-regression: ${results.map((r) => `${r.name} ${r.status === null ? 'skipped' : `exit ${r.status}`}`).join(', ')}`,
);
const failed = results.find((r) => r.status !== null && r.status !== 0);
process.exit(failed ? failed.status : 0);

---
inclusion: auto
name: safe-changes
description: Use before consequential or irreversible actions (deleting, dependency or lockfile changes, CDK or AWS commands, billable calls, pushes, editing Kiro settings), for risky edits to existing or shared files, and whenever you need to report a risk and ask for approval.
---

# Safe changes: procedure and risk report

The mandatory rules are in `safety.md` (always on) and the edit procedure is the `safe-change` skill (`.kiro/skills/safe-change/SKILL.md`). This file adds the minimal-change checklist and the format for asking before a consequential action. It doesn't replace either.

## Minimal-change checklist

1. Scope first: one or two sentences naming the files you'll touch and what stays untouched.
2. Snapshot `git status --short` before editing. Paths already modified or untracked belong to the user.
3. Edit around user changes in the same file; never revert or reformat them.
4. No drive-by renames, refactors, or formatting. Format only files you changed (`pnpm exec prettier --write <files>`).
5. After editing, compare `git status --short` with the snapshot. Any unexpected path is a finding to report, not something to "clean up".

## Risk report (send it, then wait)

```
Action:        <exact command or edit>
Why needed:    <what it achieves; why a smaller step won't do>
Targets:       <exact paths, packages, AWS resources, stage, region; account ID redacted>
Reversible?:   <yes/no, and how to undo>
What could go wrong: <data loss, cost, broken deploy, lockfile churn, ...>
Less destructive option: <rename/backup, read-only variant (diff, synth, --check), or skip>
Waiting for:   explicit "yes" for this action only
```

Approval covers only the action and targets named in the report.

## Always needs a risk report

- Deleting, moving, emptying, or overwriting any existing file or directory (`safety.md` rule 4).
- Dependency or lockfile changes (then the `dependency-change` skill).
- `cdk deploy`/`bootstrap`/`destroy`/`watch` (then the `cdk-change` skill). For `cdk diff` against the real account, follow the `cdk-change` skill's go-ahead step instead (`cdk.md` treats it as read-only).
- Billable calls: Bedrock (including `RUN_BEDROCK_EVAL=1`), Transcribe, Cost Explorer.
- Pushing anywhere other than a `feature/*` branch, or opening or merging PRs outside the `handoff-update` flow (`git-workflow.md`).
- Editing `.kiro/settings/` (MCP config, permissions) or anything in `~/.kiro/`.
- Downloads such as `playwright install`.

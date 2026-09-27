# Proof & Poise: instructions for Claude Code

This repo was started with Kiro. The project rules live in `.kiro/`, and this file loads them for Claude Code, so both tools follow the same rules. Edit the rules in `.kiro/steering/`, not here.

Start with `HANDOFF.md`. It says where work stopped and what comes next.

## Always-on rules

@.kiro/steering/product.md
@.kiro/steering/tech.md
@.kiro/steering/structure.md
@.kiro/steering/engineering.md
@.kiro/steering/safety.md
@.kiro/steering/git-workflow.md

## Area rules (read before editing that area)

- `apps/web/**`: `.kiro/steering/frontend.md`
- `services/**`: `.kiro/steering/backend.md`
- `infrastructure/**`: `.kiro/steering/cdk.md`

## Spec (source of truth)

- `.kiro/specs/proof-and-poise/requirements.md`: what to build (numbered requirements, e.g. Req 2.3)
- `.kiro/specs/proof-and-poise/design.md`: how to build it (sections, e.g. design §10)
- `.kiro/specs/proof-and-poise/tasks.md`: the task list. `deps:` must be done first. When a task is finished, change its `- [ ]` to `- [x]`. Ignore `tasks.meta.json`, which is Kiro's internal state.

## Playbooks (read the matching file and follow it)

- New feature, screen, API route, or spec task: `.kiro/skills/feature-delivery/SKILL.md`
- Any edit to existing files or a bug fix: `.kiro/skills/safe-change/SKILL.md`
- Adding, removing, or upgrading an npm dependency: `.kiro/skills/dependency-change/SKILL.md`
- Anything in `infrastructure/`, or any `cdk` command: `.kiro/skills/cdk-change/SKILL.md`

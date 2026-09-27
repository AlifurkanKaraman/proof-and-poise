## Summary

<!-- What changed and why. Link the spec task, e.g. "Task 8". -->

## Testing

<!-- Commands run and results (typecheck, lint, test, build, e2e, manual checks). -->

## Security checklist

- [ ] No secrets, credentials, tokens, or AWS account IDs in code, config, fixtures, or screenshots
- [ ] No `.env*` files committed (only `.env.example`, placeholders only)
- [ ] No logging of user content (resume, job text, answers, transcripts, prompts, model output, request bodies); logs use the allowlisted logger only
- [ ] All new inputs validated with the shared Zod schemas on client and server
- [ ] Model output is schema-validated and grounding-checked before it becomes state
- [ ] IAM changes are least-privilege and scoped to specific ARNs; any required wildcard is documented
- [ ] Session-scoped routes require the bearer token; errors don't reveal whether a session exists
- [ ] No new AWS resources that break the cost rules (no NAT, VPC, provisioned throughput, always-on compute)
- [ ] New dependencies are pinned to exact versions and are well-known packages
- [ ] Personal data in fixtures is fictional

## Checklist

- [ ] Conventional Commit title (e.g. `feat: …`, `fix: …`, `chore: …`)
- [ ] Targets `develop` (or `main` for a release PR)
- [ ] Reviewed by the other developer

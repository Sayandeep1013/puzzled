---
name: verify
description: Alias for verification-before-completion — before claiming work is done, fixed, or passing (and before committing/pushing/PRs), run the project's verification commands and confirm the output.
---

# Verify (alias)

This is a short alias. Invoke the `verification-before-completion` skill (via the
Skill tool) and follow it exactly.

Concretely for this repo, run and read the output of:

- `npm run typecheck`
- `npm run lint`
- `npm test`

State evidence (actual pass/fail output) before asserting success. Never claim
"done" or "passing" without having run these in the same session.

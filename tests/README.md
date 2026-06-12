# Test Plan

Future automated tests will validate:

- Trigger recognition and non-trigger cases.
- Command-family and argument allowlists.
- Rejection of mixed chains containing restricted operations.
- Evidence-pack JSON Schema validity.
- Prevention of false `complete` status.
- Zero intentional mutation from audit-only skills.
- Adapter extension without restriction weakening.
- Sanitization of paths, identifiers, and command summaries.
- Skill-manifest and command-policy schema validity.
- Exclusion of restricted evidence from reusable procedures.

Use disposable fixture repositories and compare filesystem, Git, process, and mock remote-state snapshots before and after invocation.

See the focused trigger, policy, safety, evidence, adapter, fixture, and privacy plans in this directory.

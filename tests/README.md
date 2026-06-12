# Tests

Run the dependency-free release suite with:

`node scripts/test-pack.mjs`

The current suite verifies:

- The exact approved five-skill inventory.
- Manifest, command-policy, and evidence-pack schema validity.
- Manifest reference resolution and mode agreement.
- The single action-capable skill boundary.
- Complete restricted-category coverage.
- Audit-only no-change evidence.
- Semantic rejection of false `complete` claims.
- Adapter extension without restriction weakening.
- Audit-only agent prompt boundaries.
- Restricted-operation rejection in executable examples.
- A synthetic dependency-free repository fixture.
- Required `.gitignore` protections.

`node scripts/validate-pack.mjs .` adds structural, link, secret-pattern, CI, and release-file checks.

Focused directories retain the remaining test design for future trigger classifiers, command parsers, mutation snapshots, and privacy fixtures.

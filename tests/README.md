# Tests

Run the dependency-free release suite with:

`node scripts/test-pack.mjs`

The current suite verifies 30 release conditions, including:

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
- Positive, negative, and wrong-skill trigger classification.
- Obvious shell-policy bypasses without claiming full POSIX parsing.
- Audit-only documentation mutation checks and content snapshots.
- Synthetic sensitive-shape detection and redaction.
- Adapter permission, failure, completion, secret, and mode overrides.
- Formal adapter schema and bidirectional compatibility.
- Property-generated command-policy bypass combinations.
- A matrix of schema-valid but semantically false completion claims.

`node scripts/validate-pack.mjs .` adds structural, link, secret-pattern, CI, and release-file checks.

`node --test` exercises built-in Node fixtures. See the [harness guide](../docs/testing/README.md) for design boundaries.

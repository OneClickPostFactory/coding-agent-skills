# Tests

Run the dependency-free release suite with:

`node scripts/test-pack.mjs`

The current suite verifies 48 release conditions, including:

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
- External adapter discovery across all supported locations.
- Mixed, empty, missing, malformed, traversal, symlink, and secret-file behavior.
- Stable adapter CLI exit codes and safe summaries.
- Project declaration schema, exact pins, compatible ranges, and multiple adapters.
- Project installation rejection for stale versions, mismatches, unsafe paths, and weakening.
- Project `.env` avoidance, declaration symlink rejection, and secret-safe summaries.
- Safe adapter upgrades and distinct stale exact-pin and compatible-range detection.
- Upgrade rejection for core, schema, skill, mode, policy, evidence, secret, and path drift.
- Property-generated command-policy bypass combinations.
- A matrix of schema-valid but semantically false completion claims.

`node scripts/validate-pack.mjs .` adds structural, link, secret-pattern, CI, and release-file checks.

`node --test` exercises built-in Node fixtures. See the [harness guide](../docs/testing/README.md) for design boundaries.

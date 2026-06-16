# Evidence Bundles

Evidence bundles group already-produced evidence files into a deterministic, read-only
verification unit.

## What The Harness Verifies

- The bundle matches `schemas/evidence-bundle.schema.json`.
- Every entry path is relative, local to the bundle, non-symlinked, and not a local
  environment-file path.
- Every entry hash matches the declared SHA-256 digest.
- Evidence-pack entries validate against the shared evidence-pack contract.
- Adapter-upgrade entries validate against the adapter-upgrade evidence contract.
- Entry statuses match their declared expected status.
- Evidence does not claim state mutation.
- Replay produces the same canonical report hash inside a single verification run.
- The target release preserves all declared baseline entries without status regression.

## Command

```bash
node scripts/verify-evidence-bundle.mjs tests/fixtures/evidence-bundles/valid-bundle/evidence-bundle.json
```

Use `--json` when a caller needs the structured report. The report is sanitized and does
not include raw evidence bodies or secret values.

## Boundaries

The verifier is an evidence harness only. It does not create skills, install packages,
write project files, apply upgrades, touch real project repositories, run deployments, run
migrations, mutate services, read local environment files, or publish releases.

Real project evidence bundles remain deferred until separately approved.

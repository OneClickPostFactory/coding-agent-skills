# Evidence Bundles

Evidence bundles group already-produced evidence files into a deterministic, read-only
verification unit.

## What The Harness Verifies

- The bundle matches `schemas/evidence-bundle.schema.json`.
- The bundle declares a retention policy with a bounded review window, storage class,
  and redaction rule.
- The bundle declares provenance for the producing harness and target tag.
- The provenance section follows the detached-signature design. Synthetic fixtures may
  remain unsigned, but non-fixture bundles cannot use that shortcut.
- The archive policy allows only sanitized JSON summaries, never raw evidence bodies or
  secret values.
- Every entry path is relative, local to the bundle, non-symlinked, and not a local
  environment-file path.
- Every entry hash matches the declared SHA-256 digest.
- Evidence-pack entries validate against the shared evidence-pack contract.
- Adapter-upgrade entries validate against the adapter-upgrade evidence contract.
- Entry statuses match their declared expected status.
- Evidence does not claim state mutation.
- Replay produces the same canonical report hash inside a single verification run.
- The target release preserves all declared baseline entries without status regression.

## Retention And Provenance

Retention metadata is advisory evidence, not a deletion scheduler. The verifier checks that
the declared review window is long enough for synthetic fixtures or maintainer release
evidence and that `retainUntil` is after `generatedAt` by at least the declared minimum
days.

Provenance is a signed-provenance design contract. The pilot does not create real
signatures or publish release attestations. It does require the bundle to name the
producer, source commit, target release tag, canonicalization strategy, digest algorithm,
and detached-signature policy so future signing can be added without changing the safety
model.

## Archive Reports

Archive reports are sanitized summaries derived from a verified bundle. They include
bundle identity, entry identifiers, replay hash, regression status, retention metadata,
and provenance metadata. They do not include raw evidence bodies, command output, local
home paths, credentials, or secret-like values.

```bash
node scripts/render-evidence-archive-report.mjs tests/fixtures/evidence-bundles/valid-bundle/evidence-bundle.json
```

Use `--json` to print the structured sanitized report to stdout. The command does not
write archive files; storing a report remains a separate approval boundary.

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

The archive-report renderer follows the same read-only boundary. It renders sanitized
stdout only and does not create or update archive destinations.

Real project evidence bundles remain deferred until separately approved.

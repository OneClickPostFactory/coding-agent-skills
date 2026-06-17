# Evidence Bundles

Evidence bundles group already-produced evidence files into a deterministic, read-only
verification unit.

## What The Harness Verifies

- The bundle matches `schemas/evidence-bundle.schema.json`.
- The bundle declares a retention policy with a bounded review window, storage class,
  and redaction rule.
- The retention policy includes an expiry advisory. The advisory may report `retained`,
  `review-soon`, or `expired-review-required`, but it is manual-review-only and never
  deletes or moves evidence.
- The bundle declares provenance for the producing harness and target tag.
- The provenance section follows the detached-signature design. Synthetic fixtures may
  remain unsigned, but non-fixture bundles cannot use that shortcut.
- The detached-signature section includes a verification plan with required future
  artifacts. The harness validates the plan but does not perform cryptographic signing or
  signature verification.
- The archive policy allows only sanitized JSON summaries, never raw evidence bodies or
  secret values.
- The archive policy may link to a synthetic sanitized archive index that records entry
  identifiers, hashes, retention summary, and provenance summary.
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
days. Expiry status is reported as advisory evidence for human review only. It is not a
deletion system and it does not change retention state.

Provenance is a signed-provenance design contract. The pilot does not create real
signatures or publish release attestations. It does require the bundle to name the
producer, source commit, target release tag, canonicalization strategy, digest algorithm,
and detached-signature policy so future signing can be added without changing the safety
model. The verification plan names the canonical bundle JSON, detached signature, and
public verification identity that a future verifier would require. `validatesSignatureNow`
must remain `false` in this milestone.

## Archive Indexes

Archive indexes are synthetic sanitized fixtures validated against
`schemas/archive-index.schema.json`. They are metadata-only indexes for bundle review. An
index may list bundle entry IDs, expected statuses, hashes, retention advisory status, and
signature-plan status, but it must not contain raw evidence bodies, command output, local
paths, credentials, or secret-like values.

The verifier checks that the index belongs to the bundle, matches the current entry set,
preserves entry hashes, links to retention metadata, and declares no state change.

## Archive Reports

Archive reports are sanitized summaries derived from a verified bundle. They include
bundle identity, entry identifiers, replay hash, regression status, retention metadata,
retention-expiry advisory status, provenance metadata, detached-signature verification
planning metadata, and archive-index status. They do not include raw evidence bodies,
command output, local home paths, credentials, or secret-like values.

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

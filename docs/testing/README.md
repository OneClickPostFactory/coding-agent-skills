# Harness

The harness is dependency-free and runs through:

- `node scripts/validate-pack.mjs .`
- `node scripts/test-pack.mjs`
- `node scripts/validate-maintainer-loop.mjs .`
- `node scripts/validate-adapters.mjs tests/fixtures/external-adapters/valid-basic`
- `node scripts/validate-project-adapters.mjs tests/fixtures/project-adapter-installation/valid-exact-pin`
- `node scripts/check-adapter-upgrade.mjs tests/fixtures/project-adapter-upgrades/valid-upgrade/before tests/fixtures/project-adapter-upgrades/valid-upgrade/after`
- `node scripts/check-adapter-upgrade-chain.mjs tests/fixtures/project-adapter-upgrade-chains/valid-chain`
- `node scripts/verify-evidence-bundle.mjs tests/fixtures/evidence-bundles/valid-bundle/evidence-bundle.json`
- `node scripts/render-evidence-archive-report.mjs tests/fixtures/evidence-bundles/valid-bundle/evidence-bundle.json`
- `node --test`

## Trigger Classification

Synthetic prompts identify the least-privileged matching pilot skill and reject mutation or publication requests. The classifier is a harness oracle, not a production router.

## Command Policy

The command analyzer handles obvious composition, multiline scripts, pipelines, wrappers, heredocs, redirects, project scripts, Git, provider-specific `npx`, curl approval, runtime status commands, and restricted arguments.

Property-style tests generate combinations of safe prefixes, shell separators, and restricted suffixes. They exist to catch repeated bypass families without manually writing every combination.

This is intentionally conservative and is not a complete POSIX parser. Unknown execution, quoting ambiguity, or unsupported shell syntax must fail closed.

## Mutation Snapshots

Audit-only Markdown is scanned for restricted commands presented as procedures. Commands in explicitly denied or negative contexts remain documentation. Synthetic snapshot targets are hashed before and after checks.

## Route Trace

Synthetic route-trace projects cover generic bounded static scanning, adapter-declared
scope, verified Next.js route files, inferred React Router and Express-style declarations,
skipped paths, not-verified runtime route classes, and repo-map-only adapter skips.
Route-trace tests must never run a target project, hit URLs, build, test, deploy, migrate,
or read `.env` files.

## Env Audit

Synthetic env-audit projects cover value-free variable-name detection, `.env` exclusion,
`.env.example` inspection, adapter-declared scope, and adapter-present-but-not-enabled
behavior. Env-audit tests must never print values, validate credentials, contact APIs,
run target projects, build, test, deploy, migrate, or read `.env` files.

## Privacy And Redaction

Sensitive shapes are stored as ordered synthetic parts and reconstructed only in memory. Tests verify type detection, redaction, and absence from reusable skill content without printing fixture values.

## Adapter Weakening

Valid adapters must pass both JSON Schema validation and semantic compatibility checks. Tests cover narrowing, documentation precedence, and status-only hints, then reject deployment, Git publication, failure suppression, completion overrides, secret exposure, missing restrictions, stale skill versions, required-evidence removal, scope expansion, and audit-mode overrides.

## External Adapter Discovery

Disposable fixture roots exercise all three discovery conventions. The harness accepts valid
roots and rejects malformed JSON, unknown manifests, incompatible skills and versions,
restriction weakening, mixed roots, traversal, and symlink escapes. Missing roots fail;
empty roots return a clear zero-adapter result. CLI tests also confirm stable exit codes and
that summaries do not echo manifest commands or identifiers.

## Project Installation And Pins

Disposable project roots cover exact pins, compatible ranges, multiple adapters, missing or
ambiguous declarations, unsupported old and future cores, malformed semver, unknown skills,
adapter version mismatch, invalid locations, restriction weakening, secret exposure, scope
expansion, traversal, and symlink escape. Privacy tests verify that unrelated `.env` files
are ignored and secret-like declaration content is rejected without appearing in summaries.

## Adapter Upgrade And Stale Pins

Paired simulated revisions cover safe exact and ranged upgrades, stale exact pins, stale
ranges, unsupported old and future cores, adapter schema drift, skill compatibility drift,
restriction weakening, mode escalation, evidence removal, failure suppression, completion
override, secret exposure, unknown skills, and traversal. CLI tests confirm stable exit
codes and summaries that do not echo adapter identifiers or secret-like values.

## Upgrade Evidence And Chains

Upgrade evidence examples validate against a dedicated JSON Schema and always declare
`changedState.changed: false`. Pair and chain CLIs support sanitized `--json` output and a
non-overwriting relative `--output` file.

Ordered chain fixtures cover accepted patch progression, stale pins, broken core and skill
compatibility, schema drift, restriction weakening, evidence removal, failure suppression,
completion override, mode escalation, `.env` avoidance, traversal, symlinks, and mutation
snapshots. Chain summaries use ordinal revision labels rather than directory names.

## Evidence Bundles

Disposable evidence bundles cover valid replay, hash mismatch, missing entries,
cross-release regression, path traversal, invalid retention windows, retention-expiry
advisory status, provenance tag mismatch, unsafe archive policy, archive-index mismatch,
and unsafe signature-verification planning. Tests verify schema validity, entry hashes,
evidence-pack semantics, adapter-upgrade evidence semantics, deterministic report hashes,
status preservation, detached-signature design metadata, verification-plan metadata,
sanitized archive indexes, sanitized archive reports, and sanitized CLI output.

## Maintainer Loop

The maintainer-loop validator checks the required root files, ledger sections, run-log
fields, executable runner mode, documented permission flags, unknown-flag rejection,
restricted-command absence, documentation links, and CI integration.

Release tests also invoke the runner without permissions and with an unknown permission.
Both cases must fail before repository inspection or mutation. A successful autonomous run
is intentionally tested after release from a clean worktree because it appends bounded
ledger and run evidence.

## False Completion

Schema-valid evidence still fails semantic completion when required consequences, successful commands, material-risk resolution, known state, confidence reasons, repository identity, or supporting evidence are missing.

Fixtures live under `tests/fixtures/`. Focused test documentation records both implemented checks and future extensions.

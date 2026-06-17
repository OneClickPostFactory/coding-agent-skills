# Changelog

All notable changes follow [Semantic Versioning](docs/versioning/README.md).

## [0.2.3] - 2026-06-17

### Added

- Synthetic evidence archive index schema and fixture files linked from evidence bundles.
- Retention-expiry advisory metadata and report output with manual-review-only semantics.
- Detached-signature verification planning metadata that records required future artifacts
  without running signing or verification infrastructure.
- Disposable advisory, archive-index, and signature-plan fixtures for safe acceptance and
  rejection coverage.

### Changed

- Evidence-bundle verification now validates archive indexes, reports retention-expiry
  advisory status, and rejects unsafe signature-verification plans.
- Archive reports now include archive-index summary, retention advisory status, and
  detached-signature verification planning metadata.
- Current synthetic examples and fixtures now target `0.2.3` with `0.2.2` as the previous
  release boundary.

## [0.2.2] - 2026-06-16

### Added

- Evidence-bundle retention metadata for bounded review windows, storage class, and
  redaction policy.
- Provenance metadata for producer, source commit, target tag, canonicalization, digest
  algorithm, and detached-signature design.
- Sanitized evidence archive report schema and read-only renderer.
- Disposable invalid fixtures for retention-window, provenance-tag, and archive-policy
  rejection.

### Changed

- Evidence-bundle verification now rejects unsafe retention, provenance, and archive
  declarations before claiming replay or regression success.
- CI, pack validation, release tests, safety docs, privacy docs, authoring docs, and
  testing docs now include archive-report rendering.
- Current synthetic examples and fixtures now target `0.2.2` with `0.2.1` as the previous
  release boundary.

## [0.2.1] - 2026-06-16

### Added

- Evidence-bundle JSON Schema and dependency-free verifier.
- Deterministic replay through canonical report hashing.
- Cross-release compatibility regression checks for baseline entry coverage and status
  preservation.
- Disposable valid and invalid evidence-bundle fixtures for hash mismatch, missing entry,
  path traversal, and regression failures.

### Changed

- CI, pack validation, release tests, safety docs, testing docs, roadmap, and ledger now
  include evidence-bundle verification.
- Current synthetic examples and fixtures now target `0.2.1` with `0.2.0` as the previous
  release boundary.

## [0.2.0] - 2026-06-15

### Added

- Root agent contract, maintainer runbook, explicit work ledger, and append-only run log.
- Dependency-free `scripts/run-next` coordinator with fail-closed permission gates.
- Dedicated maintainer-loop validator covering required files, ledger shape, executable
  mode, permission declarations, unsafe-command absence, docs, and CI integration.

### Changed

- CI and the release harness now validate the maintainer loop.
- README, roadmap, contribution, release, testing, and safety documentation now define
  autonomous milestone selection and human approval stop boundaries.
- Evidence-bundle verification remains queued in the ledger and is not implemented.

## [0.1.6] - 2026-06-14

### Added

- Machine-readable adapter-upgrade evidence schema with sanitized pair and chain examples.
- Dependency-free compatibility-chain validator for ordered simulated project revisions.
- Optional safe `--json` and non-overwriting `--output` evidence modes.
- Disposable chain fixtures for valid progression, stale pins, core and skill
  incompatibility, schema drift, and restriction weakening.
- Chain-level privacy, path, symlink, mutation, and unsafe-policy tests.

### Changed

- Pair validation can target an adjacent historical core when used inside a chain while the
  final chain revision must match the running core.
- Release validation and CI now validate a complete three-revision compatibility chain.
- Adapter, evidence, versioning, safety, authoring, testing, and roadmap documentation now
  define structured read-only upgrade review.

## [0.1.5] - 2026-06-14

### Added

- Dependency-free adapter upgrade comparison command for paired project revisions.
- Distinct stale exact-pin and stale compatible-range detection.
- Disposable revision fixtures for safe upgrades, old and future cores, schema and skill
  drift, restriction weakening, mode escalation, and evidence removal.
- Dynamic rejection coverage for failure suppression, completion override, unknown skills,
  secret exposure, and traversal.

### Changed

- Project validation can evaluate an immutable source revision against its declared core
  while upgrade acceptance remains pinned to the running shared core.
- Release validation and CI now exercise the safe adapter upgrade path.
- Adapter, versioning, safety, authoring, and testing documentation now define upgrade
  evidence and drift rejection.

## [0.1.4] - 2026-06-13

### Added

- Project-owned adapter installation declaration schema and dependency-free validator.
- Exact core pins and compatible comparator ranges without a semver dependency.
- Disposable project fixtures for valid installation, version mismatch, unsafe location,
  policy weakening, secret exposure, scope expansion, and traversal.
- Bidirectional matching of project ID, adapter root, adapter ID/version, and pilot skill IDs.

### Changed

- Release validation and CI now exercise a declared project-owned adapter installation.
- Adapter, testing, safety, authoring, and versioning documentation now define safe adoption.

## [0.1.3] - 2026-06-13

### Added

- Dependency-free external adapter discovery and validation CLI.
- Disposable fixture roots for all supported locations, compatibility failures, policy
  weakening, malformed input, mixed roots, traversal, and symlink escapes.
- Safe public rejection codes and explicit empty-root behavior.

### Changed

- Release validation and CI now exercise an external adapter root.
- Adapter documentation now defines exact manifest naming, extension-only inheritance, path
  safety, and future project-owned integration.

## [0.1.2] - 2026-06-13

### Added

- Formal project-adapter JSON Schema and three valid synthetic examples.
- Bidirectional adapter skill/version/mode compatibility tests.
- Property-style command-policy generation across composition and bypass families.
- Provider-specific `npx`, bounded-read, authenticated-health approval, and package-script-body checks.

### Changed

- Skill manifests now declare adapter contract compatibility.
- Command policies now declare parser invariants and argument strategies.
- Validator enforcement now covers valid and invalid adapters plus command-policy invariants.

## [0.1.1] - 2026-06-13

### Added

- Trigger-classification fixtures for positive, negative, and wrong-skill cases.
- Command-parser coverage for composition, wrappers, heredocs, package tools, Git, curl, and unsafe arguments.
- Mutation snapshots and audit-only documentation enforcement.
- Split synthetic privacy fixtures with in-memory detection and redaction tests.
- Adapter-weakening and evidence false-completion matrices.

### Changed

- CI now runs structural validation, the complete harness, and built-in Node tests.
- Shared policy rules and release validation enforce the v0.1.x harness boundaries.

## [0.1.0] - 2026-06-12

### Added

- Shared evidence-pack contract and schemas.
- Five pilot skills: `repo-map`, `build-verify`, `git-preflight`, `runtime-truth`, and `llm-drift-control`.
- Concrete manifests, command policies, evidence packs, and workflow examples.
- Dependency-free pack validation and executable release tests.
- Synthetic fixtures and safe GitHub Actions validation.
- Release, privacy, adapter, usage, contribution, and roadmap documentation.

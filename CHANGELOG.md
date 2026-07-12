# Changelog

All notable changes follow [Semantic Versioning](docs/versioning/README.md).

## [0.2.19] - 2026-07-12

### Fixed

- Controlled empty adapter-root validation now normalizes the legacy `empty` state to the
  public schema's `partial` state while preserving handled exit code `0`.
- Controlled unsafe states normalize to `blocked`, keeping all public JSON output inside
  the formal `complete|partial|failed|blocked` status contract.

### Tests

- Every public CLI command, including the empty-adapter result, is validated against
  `schemas/cli-result.schema.json` and the semantic read-only invariants.

## [0.2.18] - 2026-07-11

### Added

- Formal `schemas/cli-result.schema.json` contract with semantic safety validation for
  every public machine-readable CLI result.
- `coding-agent-skills audit <project-root> [--json]` for deterministic aggregation of
  the eight existing safe static repository audits.
- Synthetic aggregate-audit fixtures covering routes, environment names, API contracts,
  migrations, package-script non-execution, adapter-free discovery, partial adapter
  applicability, and unsafe-adapter rejection.

### Fixed

- Missing or non-directory project roots now return process and JSON exit code `4` with
  `missing_required_input` rather than a generic runtime failure.
- Unsafe adapter failures now return exit code `3` with `safety_refusal`.

### Safety

- Aggregate audits remain read-only, never execute target project commands, never read
  secret or `.env` files, and never deploy, migrate, install, build, test, or mutate the
  inspected repository.

## [0.2.17] - 2026-07-04

### Changed

- `repo-map` now supports generic safe discovery when no `.coding-agent` project declaration exists.
- JSON output now reports `adapterPresent: false`, `mode: generic-safe-discovery`, reduced confidence, `changedState: false`, no target-project commands, and no secret-file reads for no-adapter repo-map runs.
- Invalid or unsafe project adapters still fail closed instead of falling back silently.
- Usage, adapter, and release documentation now clarify that adapters are optional hints, not mandatory requirements.

## [0.2.16] - 2026-07-03

### Added

- Optional `--json` output for every public `coding-agent-skills` CLI command.
- OpenClaw-compatible structured result fields for command identity, skill id, package
  version, status, findings, warnings, skipped checks, refused behavior, safety summary,
  `recommendedNextAction`, and exit-code meaning.
- Release tests that validate the JSON contract across the public CLI surface and confirm
  redaction of local home paths and secret-like values.

### Changed

- The public wrapper now preserves default human-readable output while offering sanitized
  machine-readable results for orchestrator callers.
- Usage, release, testing, roadmap, ledger, and run-log docs now describe the exit-code
  contract and OpenClaw integration boundary.
- Stale v0.2.15 ledger and run-log entries now reflect that the deployment-preflight
  release was published, smoke-tested, and released.

## [0.2.15] - 2026-07-03

### Added

- `deployment-preflight` audit-only skill for static deployment readiness evidence
  mapping before separately approved deployment work.
- `coding-agent-skills deployment-preflight <project-root>` CLI command.
- Dependency-free deployment preflight renderer for deployment config files, deployment
  docs, package script keys without command values, platform indicators, static risk
  indicators, adapter-limited scope, skipped paths, not-verified provider/runtime areas,
  and safety refusals.
- Synthetic deployment-preflight fixtures and release tests for generic static scans,
  adapter-scoped scans, package script key detection, platform indicators, and
  repo-map-only adapter skips.

### Changed

- Adapter schemas and validators now recognize `deployment-preflight` as an audit-only
  skill while preserving the existing `0.2.3` adapter contract compatibility baseline.
- Usage, release, safety, architecture, adapter, roadmap, ledger, and run-log docs now
  describe the new static read-only deployment preflight command.

## [0.2.14] - 2026-07-03

### Added

- `github-handoff` audit-only skill for local Git handoff evidence before separately
  approved GitHub work.
- `coding-agent-skills github-handoff <project-root>` CLI command.
- Dependency-free GitHub handoff renderer for branch state, HEAD, tags at HEAD, remote
  names, changed-file summaries, secret-bearing path redaction, adapter-limited scope,
  and safety refusals.
- Synthetic github-handoff fixtures and release tests that create disposable Git
  repositories under `/tmp` for generic, adapter-scoped, and repo-map-only adapter cases.

### Changed

- Adapter schemas and validators now recognize `github-handoff` as an audit-only skill
  while preserving the existing `0.2.3` adapter contract compatibility baseline.
- Usage, release, safety, architecture, adapter, roadmap, ledger, and run-log docs now
  describe the new local Git handoff report command.

## [0.2.13] - 2026-07-03

### Added

- `migration-review` audit-only skill for static database migration and schema evidence
  review.
- `coding-agent-skills migration-review <project-root>` CLI command.
- Dependency-free migration review renderer for migration files, schema/config files,
  package script keys without command values, static risk indicators, skipped paths,
  not-verified database behavior, adapter-limited scope, and safety refusals.
- Synthetic migration-review fixtures and release tests for generic static scans,
  adapter-scoped scans, destructive-looking SQL indicators, package script key detection,
  and repo-map-only adapter skips.

### Changed

- Adapter schemas and validators now recognize `migration-review` as an audit-only skill
  while preserving the existing `0.2.3` adapter contract compatibility baseline.
- Usage, release, safety, architecture, adapter, roadmap, ledger, and run-log docs now
  describe the new static read-only migration review command.

## [0.2.12] - 2026-07-03

### Added

- `api-contract-audit` audit-only skill for static API contract surface mapping.
- `coding-agent-skills api-contract-audit <project-root>` CLI command.
- Dependency-free API contract audit renderer for contract files, endpoint declarations,
  client-call patterns, schema/type files, skipped paths, not-verified runtime behavior,
  adapter-limited scope, and safety refusals.
- Synthetic API contract fixtures and release tests for generic static scans,
  adapter-scoped scans, OpenAPI files, route handlers, client calls, schema/type files,
  and repo-map-only adapter skips.

### Changed

- Adapter schemas and validators now recognize `api-contract-audit` as an audit-only skill
  while preserving the existing `0.2.3` adapter contract compatibility baseline.
- Usage, release, safety, architecture, adapter, roadmap, ledger, and run-log docs now
  describe the new static read-only API contract audit command.

## [0.2.11] - 2026-07-03

### Added

- `secret-audit` audit-only skill for redacted static secret exposure detection.
- `coding-agent-skills secret-audit <project-root>` CLI command.
- Dependency-free secret audit renderer for high-confidence finding paths, finding types,
  counts, skipped secret-bearing paths, not-verified credential surfaces, adapter-limited
  scope, and safety refusals.
- Synthetic secret-audit fixtures and release tests for generic static scans,
  adapter-scoped scans, `.env` exclusion, matched-value omission, and repo-map-only adapter
  skips.

### Changed

- Adapter schemas and validators now recognize `secret-audit` as an audit-only skill while
  preserving the existing `0.2.3` adapter contract compatibility baseline.
- Usage, release, safety, architecture, adapter, roadmap, ledger, and run-log docs now
  describe the new redacted read-only secret-audit command.

## [0.2.10] - 2026-07-03

### Added

- `env-audit` audit-only skill for static environment variable name mapping without values.
- `coding-agent-skills env-audit <project-root>` CLI command.
- Dependency-free env audit renderer for variable names, classifications, sample files,
  skipped secret-bearing paths, not-verified runtime stores, adapter-limited scope, and
  safety refusals.
- Synthetic env-audit fixtures and release tests for generic static scans, adapter-scoped
  scans, `.env` exclusion, `.env.example` inspection, and repo-map-only adapter skips.

### Changed

- Adapter schemas and validators now recognize `env-audit` as an audit-only skill while
  preserving the existing `0.2.3` adapter contract compatibility baseline.
- Builder-mode approval for completing the remaining read-only skill wave is recorded in
  the roadmap, ledger, and run log.

## [0.2.9] - 2026-07-03

### Added

- `route-trace` audit-only skill for static route surface tracing.
- `coding-agent-skills route-trace <project-root>` CLI command.
- Dependency-free route trace renderer for verified route files, inferred route patterns,
  skipped paths, not-verified runtime route classes, adapter-limited scope, and safety
  refusals.
- Synthetic route-trace fixtures and release tests for generic static scans, adapter-scoped
  scans, and repo-map-only adapter skips.

### Changed

- Adapter schemas and validators now recognize `route-trace` as an audit-only skill while
  preserving the existing `0.2.3` adapter contract compatibility baseline.
- Package metadata, usage docs, release docs, roadmap, ledger, and run log now describe the
  new read-only route-trace command.

## [0.2.8] - 2026-06-19

### Added

- Public npm package metadata for `coding-agent-skills`.
- MIT license file with approved OneClickPostFactory copyright.
- Public npm install documentation for the supported CLI commands.

### Changed

- Package validation now requires public npm metadata, MIT license, repository metadata,
  public registry configuration, strict package allowlist, dependency-free shape, and
  installed-package safety checks.
- Release tests now cover the public package contract and installed `validate-pack`
  behavior.
- Release documentation now includes npm publish dry-run, tarball inspection, temporary
  install smoke tests, registry verification, and GitHub Release expectations.

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

# Changelog

All notable changes follow [Semantic Versioning](docs/versioning/README.md).

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

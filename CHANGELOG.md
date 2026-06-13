# Changelog

All notable changes follow [Semantic Versioning](docs/versioning/README.md).

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

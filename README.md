# Coding Agent Skills

Shared, versioned workflows for evidence-driven coding agents.

The pilot pack contains:

- Shared evidence-pack contract.
- `repo-map`: audit-only repository orientation.
- `build-verify`: controlled local validation using existing project commands.
- `git-preflight`: audit-only Git readiness inspection.
- `runtime-truth`: audit-only runtime evidence collection.
- `llm-drift-control`: audit-only claim reconciliation.

It does not contain deployment, package installation, Git publication, runtime mutation, migration, privileged API, platform-specific, or project-specific skills.

Project-specific adapters will live in their owning repositories and may narrow, but never weaken, shared safety rules.

## Principles

- Inspect before acting.
- Separate audit-only skills from action-capable skills.
- Preserve user work and external state.
- Treat restricted historical evidence as warnings, not reusable commands.
- Produce evidence before claiming completion.
- Report skipped, failed, and unverifiable checks honestly.

See [architecture](docs/architecture/README.md), [safety](docs/safety/README.md), and [authoring](docs/authoring/README.md).

## Completion Standard

Every skill emits the evidence-pack contract. A command being attempted is never enough to claim success. Required checks, skipped checks, failures, confidence, unresolved questions, and state changes must all be represented.

## Use And Validate

- Read [usage guidance](docs/usage/README.md) before selecting a skill.
- Browse [safe examples](examples/README.md) for manifests, policies, evidence packs, and workflows.
- Run `node scripts/validate-pack.mjs .` for structural validation.
- Run `node scripts/test-pack.mjs` for executable release tests.
- Run `node --test` for built-in Node fixture tests.

Governance lives in [CONTRIBUTING.md](CONTRIBUTING.md), [ROADMAP.md](ROADMAP.md), and the [release policy](docs/release/README.md).
The [harness guide](docs/testing/README.md) explains trigger, command, mutation, privacy, adapter, and completion checks.

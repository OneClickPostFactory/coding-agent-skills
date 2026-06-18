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
- Validate project adapters against [the formal adapter schema](schemas/project-adapter.schema.json).
- Review [external adapter discovery](docs/adapters/discovery.md).
- Run `node scripts/validate-adapters.mjs <adapter-root>` for a disposable external root.
- Review [project-owned installation and pinning](docs/adapters/project-installation.md).
- Run `node scripts/validate-project-adapters.mjs <project-root>` for a declared project root.
- Render adapter-aware `repo-map` orientation with
  `node scripts/render-adapter-repo-map.mjs <project-root>`.
- Review [adapter upgrade checks](docs/adapters/upgrades.md).
- Run `node scripts/check-adapter-upgrade.mjs <before-project-root> <after-project-root>`
  for disposable project revisions.
- Validate ordered revisions with
  `node scripts/check-adapter-upgrade-chain.mjs <chain-root>`.
- Review the [upgrade evidence contract](docs/adapters/upgrade-evidence.md) before using
  `--json` or explicit `--output` evidence.
- Review [evidence bundle verification](docs/evidence-bundles/README.md).
- Run `node scripts/verify-evidence-bundle.mjs <bundle-file>` for deterministic
  evidence-bundle replay and regression checks.
- Run `node scripts/render-evidence-archive-report.mjs <bundle-file>` for a sanitized,
  read-only archive report summary.
- Run `node scripts/validate-pack.mjs .` for structural validation.
- Run `node scripts/test-pack.mjs` for executable release tests.
- Run `node --test` for built-in Node fixture tests.

Governance lives in [CONTRIBUTING.md](CONTRIBUTING.md), [ROADMAP.md](ROADMAP.md), and the [release policy](docs/release/README.md).
The [harness guide](docs/testing/README.md) explains trigger, command, mutation, privacy, adapter, and completion checks.

## Autonomous Maintainer Loop

The local maintainer loop reads Git tags, `ROADMAP.md`, `CHANGELOG.md`, and
`work-ledger.md`, validates the pack, then selects the next bounded milestone. It fails
closed unless the required action is named explicitly:

```bash
./scripts/run-next --allow evidence-harness
```

Supported permissions are `harness-hardening`, `docs-hardening`, `test-hardening`,
`adapter-harness`, `evidence-harness`, `release-preflight`, `commit`, `tag`, and `push`.
These flags are approval gates, not permission to weaken shared restrictions.

The runner may update `work-ledger.md` and `runs/skill-runs.md` after a successful bounded
run. It stops before implementing an unapproved milestone or performing release
publication. See [the runbook](RUNBOOK.md) and [agent contract](AGENTS.md).

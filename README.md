# Coding Agent Skills

Shared, versioned workflows for evidence-driven coding agents.

The pilot pack contains:

- Shared evidence-pack contract.
- `repo-map`: audit-only repository orientation.
- `route-trace`: audit-only static route surface tracing.
- `env-audit`: audit-only environment variable name mapping without values.
- `secret-audit`: audit-only high-confidence secret exposure detection without values.
- `api-contract-audit`: audit-only static API contract surface mapping.
- `migration-review`: audit-only static migration and schema evidence review.
- `github-handoff`: audit-only local Git handoff evidence before separately approved GitHub work.
- `deployment-preflight`: audit-only static deployment readiness evidence mapping.
- `build-verify`: controlled local validation using existing project commands.
- `git-preflight`: audit-only Git readiness inspection.
- `runtime-truth`: audit-only runtime evidence collection.
- `llm-drift-control`: audit-only claim reconciliation.

It does not contain deployment execution, package installation, Git publication, runtime mutation, migration application, privileged API, platform-specific deployment automation, or project-specific skills.

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
- Install the public CLI with `npm install -g coding-agent-skills`.
- Run `coding-agent-skills validate-pack` to validate the installed pack.
- Run `npx coding-agent-skills validate-pack` when a one-off npm execution is preferred.
- From a clone, the same wrapper is available as `bin/coding-agent-skills validate-pack`.
- Trace static route surfaces with `coding-agent-skills route-trace <project-root>`.
- Map environment variable names with `coding-agent-skills env-audit <project-root>`.
- Find redacted secret exposure risks with `coding-agent-skills secret-audit <project-root>`.
- Map static API contract surfaces with `coding-agent-skills api-contract-audit <project-root>`.
- Review static migration and schema evidence with `coding-agent-skills migration-review <project-root>`.
- Prepare local Git handoff evidence with `coding-agent-skills github-handoff <project-root>`.
- Map static deployment readiness evidence with `coding-agent-skills deployment-preflight <project-root>`.
- Run the deterministic static bundle with `coding-agent-skills audit <project-root>`.
- Add `--json` to any public CLI command when an OpenClaw-style orchestrator
  needs a sanitized machine-readable result with `success`, `status`,
  `recommendedNextAction`, safety flags, and exit-code meaning.
- Validate project adapters against [the formal adapter schema](schemas/project-adapter.schema.json).
- Review [external adapter discovery](docs/adapters/discovery.md).
- Run `node scripts/validate-adapters.mjs <adapter-root>` for a disposable external root.
- Review [project-owned installation and pinning](docs/adapters/project-installation.md).
- Run `node scripts/validate-project-adapters.mjs <project-root>` for a declared project root.
- Render repo-map orientation with optional adapter hints and generic safe
  discovery when no adapter is present:
  `node scripts/render-adapter-repo-map.mjs <project-root>`.
- Render a static route-trace report with
  `node scripts/render-route-trace.mjs <project-root>`.
- Render a redacted secret-audit report with
  `node scripts/render-secret-audit.mjs <project-root>`.
- Render a static API contract audit report with
  `node scripts/render-api-contract-audit.mjs <project-root>`.
- Render a static migration review report with
  `node scripts/render-migration-review.mjs <project-root>`.
- Render a local GitHub handoff report with
  `node scripts/render-github-handoff.mjs <project-root>`.
- Render a static deployment preflight report with
  `node scripts/render-deployment-preflight.mjs <project-root>`.
- Render all eight safe static audits in deterministic order with
  `node scripts/render-audit-bundle.mjs <project-root>`.
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
- Review the [npm package release guide](docs/release/npm-package.md) before running
  package dry-run or publication checks.
- Run `node scripts/validate-pack.mjs .` for structural validation.
- Run `node scripts/test-pack.mjs` for executable release tests.
- Run `node --test` for built-in Node fixture tests.

Governance lives in [CONTRIBUTING.md](CONTRIBUTING.md), [ROADMAP.md](ROADMAP.md), and the [release policy](docs/release/README.md).
The [harness guide](docs/testing/README.md) explains trigger, command, mutation, privacy, adapter, and completion checks.

## Orchestrator Output

The default CLI output remains human-readable. OpenClaw-style callers can request a
structured result with `--json`:

```bash
coding-agent-skills repo-map /path/to/project --json
coding-agent-skills audit /path/to/project --json
```

JSON output is validated against [the public CLI result schema](schemas/cli-result.schema.json),
is read-only, and is sanitized. It includes command identity, package version,
skill id, status, findings, warnings, skipped checks, refused behavior, safety flags,
and `recommendedNextAction`. Exit codes follow the public contract:

- `0`: handled execution path, including complete, partial, blocked, or controlled audit results
- `2`: usage error
- `3`: safety refusal
- `4`: missing required input or file
- `5`: unexpected internal or runtime failure

OpenClaw should remain the owner of memory, routing, permissions, scheduling, user
interaction, and workflow state. `coding-agent-skills` is a safe callable evidence
producer, not an orchestrator.

Adapters are optional hints, not a prerequisite for safe orientation. `repo-map`
falls back to `generic-safe-discovery` when no `.coding-agent` declaration exists,
marks `adapterPresent: false`, reduces confidence, and still refuses target project
builds, tests, runtime checks, deploys, migrations, package installs, and secret-file
reads.

`audit` runs `repo-map`, `route-trace`, `env-audit`, `secret-audit`,
`api-contract-audit`, `migration-review`, `github-handoff`, and
`deployment-preflight` in that fixed order. It calls the existing in-process audit
libraries and returns one envelope with sanitized sub-results. It works with validated
adapter hints or generic safe discovery, and it does not run project commands.

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

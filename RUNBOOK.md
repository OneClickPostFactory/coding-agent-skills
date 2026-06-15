# Maintainer Loop Runbook

The maintainer loop helps an agent choose the next bounded repository milestone from local evidence instead of waiting for a freshly written prompt after every release.

## Normal Flow

1. Start from a clean synchronized `main`.
2. Read `AGENTS.md`, `ROADMAP.md`, `CHANGELOG.md`, and `work-ledger.md`.
3. Run the local validation suite.
4. Ask `./scripts/run-next` to select the next bounded action with an explicit permission flag.
5. Review the runner evidence in `runs/skill-runs.md`.
6. Stop at any approval boundary before implementation, release publication, or scope expansion.

## Current Safe Command

```bash
./scripts/run-next --allow evidence-harness
```

This command is expected to validate the pack, identify the recommended evidence-harness milestone, write local run evidence, and stop before implementing that milestone.

## Release Validation

Before releasing maintainer-loop changes, run:

```bash
node scripts/validate-pack.mjs .
node scripts/test-pack.mjs
node scripts/validate-maintainer-loop.mjs .
node --test
jq empty $(find . -name '*.json' -type f | sort)
git diff --check
```

## Stop Boundaries

Stop and request human approval before:

- adding or changing skills
- creating real project adapters
- touching real project repositories
- publishing release artifacts
- changing credential handling
- adding package dependencies
- weakening safety, evidence, completion, or adapter rules

The loop is a decision aid and evidence writer, not a general automation daemon.

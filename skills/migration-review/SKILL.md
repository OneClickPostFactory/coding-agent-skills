---
name: migration-review
description: Review statically visible database migration and schema evidence without connecting to databases, applying migrations, generating ORM clients, or modifying projects. Use when Codex must map migration files, schema/config files, migration-related package script keys, and static risk indicators before database work or handoff; do not use for runtime database inspection, migration execution, deploys, builds, tests, package installs, or secret-file reads.
---

# Migration Review

Map statically visible migration evidence and report what is and is not verified. Remain
audit-only and avoid turning migration discovery into database or deployment work.

This skill must not change project files, Git state, dependencies, runtime state, services,
databases, remotes, generated ORM clients, or deployment state.

## Purpose And Use

Use this skill before database work, migration handoff, or schema review when the agent needs
to understand visible migration files, schema declarations, migration config, and static
risk indicators.

Do not use it to prove database state, apply or roll back migrations, inspect deployed
databases, generate ORM clients, build, test, deploy, run package scripts, or read secrets.

## Inputs

Require a project root or starting path. Optionally accept a project adapter, intended scan
area, documentation precedence, migration directory hints, or known ORM/database boundaries.

Do not assume a missing migration directory means no database exists, migration filenames
reflect applied state, schema files match production, package script keys are safe to run, or
a project adapter enables this skill unless validation proves it.

## Procedure

1. Record user intent, project root, declared scope, adapter state, and safety boundary.
2. Validate a project adapter when present before reading adapter-declared metadata.
3. If an adapter is present but does not enable `migration-review`, stop static file reading
   and report the adapter-limited skip.
4. Build scan scope from adapter safe read paths when available; otherwise use a bounded
   generic static scan.
5. Exclude `.env`, secret-bearing files, generated output, dependency paths, and oversized
   files before reading.
6. Identify statically visible migration files and migration directories.
7. Identify schema and migration config files.
8. Identify package script keys that mention migration tools without printing command values.
9. Identify static risk indicators such as drop-column, truncate, rename, or raw data update
   patterns without judging runtime safety.
10. Emit the shared evidence pack or migration review report before claiming completion.

Use [checklist.md](checklist.md). Consult [failure-modes.md](failure-modes.md),
[adapter-interface.md](adapter-interface.md), and [examples.md](examples.md). Format findings
with [evidence-template.md](evidence-template.md).

## Evidence, Recovery, And Dependencies

Emit repository identity, adapter state, scan scope, ignored paths, files scanned, migration
files, schema files, config files, package script keys, risk indicators, skipped items,
not-verified areas, warnings, and changed-state declaration through the shared evidence-pack
contract.

Recover from missing migration directories, ambiguous ORM layouts, unreadable files, or
adapter limits by reporting uncertainty. Never recover by connecting to a database, applying
migrations, generating ORM clients, installing dependencies, building, testing, deploying,
broadening adapter scope, or reading `.env`.

This skill depends on the evidence-pack contract and may consume validated project adapters.
Adapters may add safe paths, ignored paths, documentation precedence, and evidence
requirements, but cannot weaken policy or turn this skill into database work.

## Approval Boundary

Explicit approval may permit one named non-secret static file read outside normal source
paths. Approval does not permit `.env` or secret-file reads, database connections, migration
execution, ORM generation, package installation, builds, tests, runtime checks, deployments,
Git mutation, or project writes.

## Completion

Claim `complete` only when the declared static scan scope was inspected, visible migration
surfaces are reported, skipped and not-verified areas are explicit, adapter limitations are
clear, and no project, Git, dependency, runtime, service, database, remote, generated-code, or
deployment state changed.

Report `partial`, `failed`, or `blocked` when adapter scope prevents scanning, requested
evidence requires database/runtime behavior, the project root cannot be established, or
safety exclusions prevent the requested conclusion.

These conditions are both the acceptance criteria and definition of done.

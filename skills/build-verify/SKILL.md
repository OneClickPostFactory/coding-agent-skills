---
name: build-verify
description: Discover and run existing project-native lint, typecheck, test, build, and targeted-test commands as controlled local validation. Use after code changes, when reproducing CI failures, or before handoff; do not use to install dependencies, auto-fix files, deploy, migrate, or validate live runtime state.
---

# Build Verify

Validate the changed scope with existing project commands and emit an evidence pack. This skill is action-capable only for approved local validation that the repository already defines.

## Purpose And Use

Use after code changes, for bounded CI reproduction, or before handoff. Do not use for dependency setup, auto-repair, deployment, migration, publication, or live-runtime health.

## Inputs

Require repository root and changed or requested scope. Optionally accept required checks, target tests, time budget, known pre-existing failures, and a project adapter.

Do not assume scripts exist, dependencies are installed, a successful build proves tests pass, or a failure was caused by the current change.

## Command Policy

First inspect known manifests. Permit only discovered, non-mutating validation scripts for:

- lint without auto-fix
- typecheck
- targeted tests
- full tests
- build or compile
- repository-provided verification checks inspected before use

Do not install, add, update, audit-fix, deploy, migrate, update snapshots, run watch mode, rewrite generated files, auto-fix, or invoke scripts whose behavior is unknown. Treat any script containing a restricted operation as rejected.

The skill may execute only discovered local validation commands. It must record any files those tools change and cannot silently accept generated mutations.

## Procedure

1. Obtain repository identity and working-tree context, using `repo-map` evidence when available.
2. Inspect package or build manifests and CI configuration to discover applicable commands.
3. Classify each command as allowed, restricted, unknown, or not applicable.
4. Run the narrowest relevant check first.
5. Run required broad checks in the repository's established order.
6. Record exit status, duration, concise output, and whether a failure is new, pre-existing, or unclassified.
7. Rerun only checks affected by an approved repair; do not repair outside this skill.
8. Emit the shared evidence pack.

Use [checklist.md](checklist.md). Consult [failure-modes.md](failure-modes.md), [adapter-interface.md](adapter-interface.md), and [examples.md](examples.md). Format findings with [evidence-template.md](evidence-template.md).

## Evidence, Recovery, And Dependencies

Emit discovered scripts, required and skipped checks, command results, durations, failure classification, changed state, and the final verification matrix. Recover from missing tools, timeouts, flaky checks, or malformed scripts by recording the limitation and using only safer discovered checks; never install or mutate to recover.

Depend on repository identity from `repo-map` or equivalent evidence and the evidence-pack contract. Adapters may define safe aliases, order, selectors, and timeouts but cannot permit restricted behavior. Safe usage runs existing lint, typecheck, test, and build checks; unsafe usage installs dependencies or invokes fix/deploy scripts.

## Approval Boundary

Normal local validation needs no additional approval after command discovery. Installation, file-changing fix modes, snapshot updates, migrations, deployments, network publication, and external-system mutation remain outside this skill even if a project script exposes them.

## Completion

Claim `complete` only when all required applicable checks passed and skipped checks do not weaken the requested conclusion. Report `partial`, `failed`, or `blocked` when dependencies, timeouts, missing scripts, or failures prevent full validation. Never claim a check passed when it was not run.

These conditions are both the acceptance criteria and definition of done.

---
name: deployment-preflight
description: Map statically visible deployment readiness evidence without deploying, calling provider APIs, installing packages, building, testing, reading secrets, or mutating project/runtime state. Use when Codex needs a bounded pre-deploy orientation report from config files, docs, package script keys, and static platform indicators before separately approved deployment work.
---

# Deployment Preflight

Map deployment-related evidence that is already visible in the repository. Remain
audit-only and avoid turning preflight discovery into deployment, cloud, runtime, build, or
secret work.

This skill must not change project files, Git state, dependencies, runtime state, services,
databases, cloud provider state, remotes, deployment targets, or generated outputs.

## Purpose And Use

Use this skill before deployment planning, release handoff, or platform-specific work when
the agent needs to understand visible deployment config, deployment docs, platform hints,
and static readiness risks.

Do not use it as proof of deployability, provider CLI behavior, cloud API state, domain
validity, environment values, build outcomes, test outcomes, service runtime, deployment
publication, database migration state, or secret content.

## Inputs

Require a project root or starting path. Optionally accept a project adapter, intended scan
area, documentation precedence, deployment config hints, or known platform boundaries.

Do not assume a missing deployment config means no deployment exists, package script keys are
safe to run, provider credentials are present, remote state matches repository state, or a
project adapter enables this skill unless validation proves it.

## Procedure

1. Record user intent, project root, declared scope, adapter state, and safety boundary.
2. Validate a project adapter when present before reading adapter-declared metadata.
3. If an adapter is present but does not enable `deployment-preflight`, stop static file
   reading and report the adapter-limited skip.
4. Build scan scope from adapter safe read paths when available; otherwise use a bounded
   generic static scan.
5. Exclude `.env`, secret-bearing files, generated output, dependency paths, build output,
   runtime output, and oversized files before reading.
6. Identify deployment config files and platform indicators.
7. Identify deployment documentation and runbook references.
8. Identify package script keys that mention deployment tooling without printing command
   values.
9. Identify static risk indicators without judging runtime or provider safety.
10. Emit the shared evidence pack or deployment preflight report before claiming completion.

Use [checklist.md](checklist.md). Consult [failure-modes.md](failure-modes.md),
[adapter-interface.md](adapter-interface.md), and [examples.md](examples.md). Format findings
with [evidence-template.md](evidence-template.md).

## Evidence, Recovery, And Dependencies

Emit repository identity, adapter state, scan scope, ignored paths, files scanned, deployment
config files, deployment docs, package script keys, platform indicators, risk indicators,
skipped items, not-verified areas, warnings, and changed-state declaration through the
shared evidence-pack contract.

Recover from missing configs, ambiguous platform hints, unreadable files, or adapter limits
by reporting uncertainty. Never recover by deploying, running provider CLIs, calling cloud
APIs, installing dependencies, building, testing, starting services, broadening adapter
scope, or reading `.env`.

This skill depends on the evidence-pack contract and may consume validated project adapters.
Adapters may add safe paths, ignored paths, documentation precedence, and evidence
requirements, but cannot weaken policy or turn this skill into deployment work.

## Approval Boundary

Explicit approval may permit one named non-secret static file read outside normal source
paths. Approval does not permit `.env` or secret-file reads, provider API calls, provider CLI
execution, package installation, builds, tests, runtime checks, service mutation,
deployments, migrations, Git mutation, or project writes.

## Completion

Claim `complete` only when the declared static scan scope was inspected, visible deployment
surfaces are reported, skipped and not-verified areas are explicit, adapter limitations are
clear, and no project, Git, dependency, runtime, service, database, cloud provider, remote,
deployment, or generated-output state changed.

Report `partial`, `failed`, or `blocked` when adapter scope prevents scanning, requested
evidence requires deployment/runtime/provider behavior, the project root cannot be
established, or safety exclusions prevent the requested conclusion.

These conditions are both the acceptance criteria and definition of done.

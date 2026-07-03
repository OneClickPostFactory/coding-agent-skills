---
name: route-trace
description: Trace statically visible application route surfaces without executing project code or changing state. Use when Codex must identify Next.js, API, React Router, Express/Fastify/Hono, or route-config surfaces from files before editing, reviewing, or planning route work; do not use for runtime URL probing, server execution, builds, tests, deployment checks, migrations, or runtime truth claims.
---

# Route Trace

Identify route surfaces from static project files and emit an evidence-backed report. Remain audit-only and fail closed when route evidence would require execution or secret-bearing configuration.

This skill must not change project files, Git state, dependencies, runtime state, services,
databases, remotes, or deployment state.

## Purpose And Use

Use this skill to locate and classify statically visible routes before changing application code, reviewing API surfaces, or planning route-level work. It can identify verified route files and inferred route declarations, but it must not claim that a route works at runtime.

Do not use this skill for live endpoint checks, server startup, browser tests, build verification, deployment readiness, migrations, database inspection, or secret auditing.

## Inputs

Require a project root or starting path. Optionally accept a project adapter, intended route area, maximum static scan depth, or named route framework to prioritize.

Do not assume every route is statically discoverable, every route file is reachable in production, framework conventions are current, an adapter covers all route surfaces, or documentation route lists are authoritative.

## Procedure

1. Record user intent, project root, declared scope, adapter state, and safety boundary.
2. Validate a project adapter when present before reading adapter-declared metadata.
3. If an adapter is present but does not enable `route-trace`, stop static file reading and report the adapter-limited skip.
4. Build the scan scope from adapter safe read paths when available; otherwise use a bounded generic static scan.
5. Apply ignored paths and secret-file exclusions before reading any file.
6. Identify verified route files from static conventions such as Next.js `app/` and `pages/` route files.
7. Identify inferred route patterns from visible declarations such as React Router paths, Express/Fastify/Hono registrations, and route config objects.
8. Label every finding as verified, inferred, skipped, not verified, or adapter-limited.
9. Report skipped files, unverified runtime-dependent areas, branch state warnings, and safety refusals.
10. Emit the shared evidence pack or route-trace report before claiming completion.

Use [checklist.md](checklist.md). Consult [failure-modes.md](failure-modes.md), [adapter-interface.md](adapter-interface.md), and [examples.md](examples.md). Format findings with [evidence-template.md](evidence-template.md).

## Evidence, Recovery, And Dependencies

Emit repository identity, adapter state, scan scope, ignored paths, verified route files, inferred route patterns, skipped items, not-verified route classes, warnings, and changed-state declaration through the shared evidence-pack contract.

Recover from missing adapters, unsupported frameworks, unreadable files, or ambiguous route declarations by narrowing scope and reporting uncertainty. Never recover by installing dependencies, running app code, starting servers, hitting URLs, broadening adapter scope, reading `.env`, or mutating files.

This skill depends on the evidence-pack contract and may consume validated project adapters. Adapters may add safe paths, ignored paths, documentation precedence, and evidence requirements, but cannot weaken policy or turn this skill into runtime verification.

## Approval Boundary

Explicit approval may permit one named non-secret static file read outside normal route paths. Approval does not permit package installation, builds, tests, runtime checks, server startup, URL probing, database inspection, migrations, deployments, Git mutation, or secret-file reads.

## Completion

Claim `complete` only when the declared static scan scope was inspected, route findings are labeled by evidence type, skipped and not-verified areas are recorded with consequences, adapter limitations are explicit, and no project, Git, dependency, runtime, service, or remote state changed.

Report `partial`, `failed`, or `blocked` when adapter scope prevents route scanning, route evidence requires execution, the project root cannot be established, or safety exclusions prevent a requested conclusion. Never claim runtime availability or route correctness from static findings alone.

These conditions are both the acceptance criteria and definition of done.

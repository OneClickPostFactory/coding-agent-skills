---
name: env-audit
description: Identify environment variable names and configuration requirements from static files without reading .env files or printing values. Use when Codex must map required, optional, sample, or inferred environment names before implementation, deployment planning, or handoff; do not use for secret validation, credential testing, API calls, runtime checks, builds, tests, deployments, migrations, or secret-file reads.
---

# Env Audit

Identify environment variable names from bounded static evidence and emit a value-free report. Remain audit-only and fail closed when evidence would require secret files, runtime state, or credential validation.

This skill must not change project files, Git state, dependencies, runtime state, services,
databases, remotes, or deployment state.

## Purpose And Use

Use this skill to map statically visible environment variable names, sample declarations, and configuration references before changing code, documenting setup, or preparing handoff. It can classify names as sample, required, optional, or inferred, but it must not claim that any value exists or works.

Do not use this skill for secret auditing, credential validation, live service checks, runtime truth claims, deployment readiness, migrations, builds, tests, or package installation.

## Inputs

Require a project root or starting path. Optionally accept a project adapter, intended config area, maximum static scan depth, or named framework/config family to prioritize.

Do not assume `.env` files may be read, variable values are safe, documented names are complete, sample files are current, runtime-injected variables are visible, or an adapter covers every configuration surface.

## Procedure

1. Record user intent, project root, declared scope, adapter state, and safety boundary.
2. Validate a project adapter when present before reading adapter-declared metadata.
3. If an adapter is present but does not enable `env-audit`, stop static file reading and report the adapter-limited skip.
4. Build the scan scope from adapter safe read paths when available; otherwise use a bounded generic static scan.
5. Exclude `.env`, `.env.*` except `.env.example`, secret-bearing paths, generated paths, dependency paths, and oversized files before reading.
6. Extract environment variable names from safe static patterns such as `process.env.NAME`, `import.meta.env.NAME`, `Deno.env.get("NAME")`, `env("NAME")`, docs, and `.env.example` declarations.
7. Never print values, line contents, tokens, credentials, or raw secret-like matches.
8. Label every finding as sample, required, optional, inferred, skipped, or not verified.
9. Report skipped files, unverified runtime/secret-store areas, branch state warnings, and safety refusals.
10. Emit the shared evidence pack or env-audit report before claiming completion.

Use [checklist.md](checklist.md). Consult [failure-modes.md](failure-modes.md), [adapter-interface.md](adapter-interface.md), and [examples.md](examples.md). Format findings with [evidence-template.md](evidence-template.md).

## Evidence, Recovery, And Dependencies

Emit repository identity, adapter state, scan scope, ignored paths, variable names, classifications, file references, sample files inspected, skipped items, not-verified areas, warnings, and changed-state declaration through the shared evidence-pack contract.

Recover from missing adapters, unreadable files, ambiguous variable names, or secret-bearing paths by narrowing scope and reporting uncertainty. Never recover by reading `.env`, printing values, validating credentials, contacting APIs, installing dependencies, running builds/tests, broadening adapter scope, or mutating files.

This skill depends on the evidence-pack contract and may consume validated project adapters. Adapters may add safe paths, ignored paths, documentation precedence, and evidence requirements, but cannot weaken policy or turn this skill into credential validation.

## Approval Boundary

Explicit approval may permit one named non-secret static file read outside normal config paths. Approval does not permit `.env` or secret-file reads, value printing, credential validation, API calls, builds, tests, package installation, runtime checks, deployments, migrations, Git mutation, or project writes.

## Completion

Claim `complete` only when the declared static scan scope was inspected, variable names are reported without values, skipped and not-verified areas are recorded with consequences, adapter limitations are explicit, and no project, Git, dependency, runtime, service, or remote state changed.

Report `partial`, `failed`, or `blocked` when adapter scope prevents env scanning, requested evidence requires secret files or runtime state, the project root cannot be established, or safety exclusions prevent a requested conclusion. Never claim credential presence or validity from static findings.

These conditions are both the acceptance criteria and definition of done.

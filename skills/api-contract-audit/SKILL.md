---
name: api-contract-audit
description: Audit statically visible API contract surfaces without running servers, calling APIs, generating schemas, or modifying projects. Use when Codex must map OpenAPI or Swagger files, route handler declarations, client request patterns, and schema/type files before API work or handoff; do not use for runtime verification, network probing, code generation, builds, tests, deployments, migrations, or secret-file reads.
---

# API Contract Audit

Map statically visible API contract evidence and report what is and is not verified. Remain audit-only and avoid turning contract discovery into runtime validation.

This skill must not change project files, Git state, dependencies, runtime state, services,
databases, remotes, generated clients, schemas, or deployment state.

## Purpose And Use

Use this skill before API work, integration handoff, or contract review when the agent needs
to understand visible API contracts from source, docs, route handlers, client calls, and
schema/type files.

Do not use it to prove deployed behavior, call endpoints, generate clients, generate
schemas, run validators, build, test, migrate, deploy, inspect databases, or read secrets.

## Inputs

Require a project root or starting path. Optionally accept a project adapter, intended scan
area, documentation precedence, contract-file hints, or known static API boundaries.

Do not assume a missing contract file means no API exists, static route declarations match
runtime behavior, client calls cover all server routes, generated clients are current, or a
project adapter enables this skill unless validation proves it.

## Procedure

1. Record user intent, project root, declared scope, adapter state, and safety boundary.
2. Validate a project adapter when present before reading adapter-declared metadata.
3. If an adapter is present but does not enable `api-contract-audit`, stop static file
   reading and report the adapter-limited skip.
4. Build scan scope from adapter safe read paths when available; otherwise use a bounded
   generic static scan.
5. Exclude `.env`, secret-bearing files, generated output, dependency paths, and oversized
   files before reading.
6. Identify statically visible OpenAPI/Swagger or API contract files.
7. Identify route handler declarations and contract path/method declarations from static text.
8. Identify client request call patterns and schema/type files.
9. Report skipped items, not-verified runtime surfaces, warnings, and safety refusals.
10. Emit the shared evidence pack or API contract audit report before claiming completion.

Use [checklist.md](checklist.md). Consult [failure-modes.md](failure-modes.md),
[adapter-interface.md](adapter-interface.md), and [examples.md](examples.md). Format findings
with [evidence-template.md](evidence-template.md).

## Evidence, Recovery, And Dependencies

Emit repository identity, adapter state, scan scope, ignored paths, files scanned, contract
files, endpoint declarations, client-call patterns, schema/type files, skipped items,
not-verified areas, warnings, and changed-state declaration through the shared evidence-pack
contract.

Recover from missing specs, ambiguous route declarations, unreadable files, or adapter
limits by reporting uncertainty. Never recover by running a server, calling an endpoint,
generating a client, generating schemas, installing dependencies, building, testing,
deploying, migrating, broadening adapter scope, or reading `.env`.

This skill depends on the evidence-pack contract and may consume validated project adapters.
Adapters may add safe paths, ignored paths, documentation precedence, and evidence
requirements, but cannot weaken policy or turn this skill into runtime or generation work.

## Approval Boundary

Explicit approval may permit one named non-secret static file read outside normal source
paths. Approval does not permit `.env` or secret-file reads, URL probes, API calls, schema
generation, client generation, package installation, builds, tests, runtime checks,
deployments, migrations, Git mutation, or project writes.

## Completion

Claim `complete` only when the declared static scan scope was inspected, visible contract
surfaces are reported, skipped and not-verified areas are explicit, adapter limitations are
clear, and no project, Git, dependency, runtime, service, remote, generated-code, or
deployment state changed.

Report `partial`, `failed`, or `blocked` when adapter scope prevents scanning, requested
evidence requires runtime or network behavior, the project root cannot be established, or
safety exclusions prevent the requested conclusion.

These conditions are both the acceptance criteria and definition of done.

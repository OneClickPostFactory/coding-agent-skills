---
name: secret-audit
description: Find high-confidence secret exposure risks in static tracked files without printing matched values. Use when Codex must identify possible token, key, credential, or private-key exposure by file path and count before handoff or cleanup; do not use for reading .env files, credential stores, rotation, validation, API calls, builds, tests, deployments, migrations, or mutation.
---

# Secret Audit

Identify high-confidence secret-like patterns from bounded static evidence and emit a redacted report. Remain audit-only and fail closed when evidence would require reading secret files or printing values.

This skill must not change project files, Git state, dependencies, runtime state, services,
databases, remotes, or deployment state.

## Purpose And Use

Use this skill to find possible tracked secret exposure by file path, pattern type, and count before handoff, publication, or cleanup. It can report suspicious files and categories, but it must not print matched values or claim whether a credential is active.

Do not use this skill for credential validation, token rotation, secret-store inspection, runtime truth claims, deployment readiness, migrations, builds, tests, or package installation.

## Inputs

Require a project root or starting path. Optionally accept a project adapter, intended scan area, maximum static scan depth, or known synthetic fixture allowance.

Do not assume ignored secret files may be read, high-confidence patterns prove exploitability, absence of findings proves absence of secrets, package contents match Git contents, or a project adapter covers every exposure surface.

## Procedure

1. Record user intent, project root, declared scope, adapter state, and safety boundary.
2. Validate a project adapter when present before reading adapter-declared metadata.
3. If an adapter is present but does not enable `secret-audit`, stop static file reading and report the adapter-limited skip.
4. Build scan scope from adapter safe read paths when available; otherwise use a bounded generic static scan.
5. Exclude `.env`, `.env.*` except deliberate `.env.example`, secret-bearing paths, generated paths, dependency paths, and oversized files before reading.
6. Scan safe static text files for high-confidence secret-like shapes.
7. Report only file path, finding type, and count. Never print matched values, snippets, tokens, credentials, or raw secret-like content.
8. Label findings, skipped items, not-verified areas, warnings, and safety refusals.
9. Emit the shared evidence pack or secret-audit report before claiming completion.

Use [checklist.md](checklist.md). Consult [failure-modes.md](failure-modes.md), [adapter-interface.md](adapter-interface.md), and [examples.md](examples.md). Format findings with [evidence-template.md](evidence-template.md).

## Evidence, Recovery, And Dependencies

Emit repository identity, adapter state, scan scope, ignored paths, files scanned, finding path/type/count, skipped items, not-verified areas, warnings, and changed-state declaration through the shared evidence-pack contract.

Recover from missing adapters, unreadable files, ambiguous patterns, or secret-bearing paths by narrowing scope and reporting uncertainty. Never recover by reading `.env`, printing values, validating credentials, rotating tokens, contacting APIs, installing dependencies, running builds/tests, broadening adapter scope, or mutating files.

This skill depends on the evidence-pack contract and may consume validated project adapters. Adapters may add safe paths, ignored paths, documentation precedence, and evidence requirements, but cannot weaken policy or turn this skill into credential handling.

## Approval Boundary

Explicit approval may permit one named non-secret static file read outside normal source paths. Approval does not permit `.env` or secret-file reads, value printing, credential validation, token rotation, API calls, builds, tests, package installation, runtime checks, deployments, migrations, Git mutation, or project writes.

## Completion

Claim `complete` only when the declared static scan scope was inspected, all findings are path/type/count only, skipped and not-verified areas are recorded with consequences, adapter limitations are explicit, and no project, Git, dependency, runtime, service, or remote state changed.

Report `partial`, `failed`, or `blocked` when adapter scope prevents scanning, requested evidence requires secret files or credential stores, the project root cannot be established, or safety exclusions prevent a requested conclusion. Never claim credential validity, revocation, or full absence of secrets from static findings alone.

These conditions are both the acceptance criteria and definition of done.

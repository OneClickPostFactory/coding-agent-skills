---
name: repo-map
description: Audit and map an unfamiliar or ambiguous source repository without modifying project, Git, dependency, runtime, or remote state. Use when Codex must locate the canonical repository, understand structure and tooling, identify entry points, tests, documentation, CI, or migrations, or establish evidence before planning code changes.
---

# Repository Map

Produce an evidence-backed repository map. Remain audit-only and fail closed when repository identity or command safety is uncertain.

## Purpose And Use

Use this skill to establish canonical repository identity, structure, tooling, entry points, tests, CI, documentation, migrations, and boundaries before implementation. Do not use it for route-level tracing, builds, runtime validation, secret auditing, or any mutation.

## Inputs

Require a starting path and the user intent or subsystem to understand. Optionally accept an expected canonical remote, maximum traversal depth, project adapter identifier, or explicit approval for one normally excluded file.

Do not assume the starting path is the repository root, the README is current, one package manifest describes the whole repository, or a familiar directory is authoritative.

## Safety Boundary

Run only bounded inspection commands:

- `pwd`
- bounded `ls`
- `rg --files` with exclusions
- bounded `find` under the candidate repository
- `git rev-parse`
- `git remote -v`
- `git status --short --branch`
- bounded reads with `sed` or `head`
- structured parsers used only to read known manifest files

Do not write files, install packages, deploy, migrate, call privileged APIs, change processes or services, read secret files, scan an unrestricted home directory, or mutate Git. Reject shell chains containing a restricted operation even when another segment is allowed.

Treat `.env`, credential stores, private keys, token files, browser profiles, cloud configuration, and similarly named files as secret-bearing. Do not read them without explicit approval.

This is audit-only behavior. It may collect evidence but must not change the inspected project or external state.

## Procedure

1. Record user intent, starting path, declared scope, and adapter.
2. Confirm the path exists without searching outside the declared scope.
3. Locate candidate repository roots with bounded inspection.
4. Establish identity with Git root, remote, branch, HEAD, and working-tree state when Git exists.
5. Stop and report ambiguity if multiple candidates remain plausible.
6. Inventory top-level files and directories with bounded depth and explicit exclusions.
7. Inspect known manifests and workspace configuration without loading secret values.
8. Identify application entry points, packages, tests, CI, documentation, migrations, and generated-code boundaries.
9. Compare documentation claims with visible code structure; label discrepancies rather than resolving them by assumption.
10. Produce the shared evidence pack before claiming completion.

Use [checklist.md](checklist.md) while executing. Consult [failure-modes.md](failure-modes.md) when a check fails, [adapter-interface.md](adapter-interface.md) when an adapter is present, and [examples.md](examples.md) for safe and unsafe cases. Format results with [evidence-template.md](evidence-template.md).

## Evidence, Recovery, And Dependencies

Emit repository identity, working-tree state, structural map, inspected manifests, boundaries, skipped checks, risks, and unresolved questions through the shared evidence-pack contract. Recover from missing paths, ambiguity, permissions, or malformed manifests only through narrower read-only inspection; never install, alter permissions, or mutate files.

This skill depends only on the evidence-pack contract. Adapters may add safe markers, paths, and evidence requirements but cannot weaken policy. Safe usage maps a named repository before editing; unsafe usage scans an entire home directory or reads secrets.

## Approval Boundary

Explicit approval may permit reading one named normally excluded file when necessary. Approval does not permit writes, installation, Git mutation, runtime mutation, deployment, migration, or privileged API access; those operations are outside this skill.

## Completion

Claim `complete` only when repository identity is established or explicitly non-Git, required structural areas were inspected, every required check is executed or recorded as skipped with consequence, no mutation occurred, uncertainties are reported, and the evidence pack is complete.

Otherwise report `partial`, `failed`, or `blocked`. Never equate command execution with successful mapping.

These conditions are both the acceptance criteria and definition of done.

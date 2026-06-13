# Safety

## Audit-Only Rule

`repo-map`, `git-preflight`, `runtime-truth`, and `llm-drift-control` must not alter project files, Git state, dependencies, processes, services, databases, remote systems, or deployment state.

`build-verify` may run existing project-native validation commands. Build or test tools may create their normal local artifacts, but the skill must declare observed changes and must reject installation, fix modes, snapshot updates, deployment, migration, or unknown scripts.

## Restricted Categories

- File writes, deletion, permission changes, or generated output inside a target project.
- Package installation, upgrade, or lockfile mutation.
- Deployments and remote publication.
- Commits, pushes, pulls, merges, rebases, resets, restores, cleans, checkouts, switches, or stashes.
- Unbounded scans outside the declared repository scope.
- Secret-file reads or commands that print credentials.
- Process or service mutation.
- Migration application or database mutation.
- Privileged or authenticated API calls.

An allowlisted executable does not make arbitrary arguments safe. Evaluate the complete shell structure and reject mixed chains containing restricted operations.

Approval must name an exceptional read and its purpose. It cannot expand an audit-only skill into a mutation skill.

## Adapter Inheritance

Project adapters inherit every shared restriction. Schema fields that could weaken safety are fixed: adapters cannot remove restrictions, override mode, suppress failures, redefine completion, expose secrets, remove evidence requirements, or expand scope without approval.

Adapter command aliases and status hints are parsed with the same command-policy harness as shared examples. A familiar alias never bypasses argument or composition checks.

External discovery is bounded to declared adapter locations and the exact `adapter.json`
filename. It rejects traversal, symlink escapes, non-regular manifests, oversized manifests,
malformed JSON, secret-like content, and mixed roots containing any rejection. The validator
does not execute adapter commands or read unrelated project files.

## Command Policy Limits

Command policies declare executable families, argument strategy, parser invariants, composition rules, and denied categories. Property-style tests exercise obvious bypass combinations, but the parser is not a complete shell implementation. Unsupported syntax fails closed.

## Restricted Evidence

Historical or extracted restricted commands may inform deny rules and warnings. They must not be copied into recommended procedures, examples, templates, or adapters.

## Secret Handling

Never reproduce tokens, credentials, cookies, private keys, service-role values, or authenticated headers. Record only the secret type and affected location.

Local `.env` files may intentionally provide credentials for separately approved authenticated operations. Load them without shell tracing, reference environment-variable names rather than literal values, and avoid output that may reveal credentials. Never commit `.env` files or place credentials in remote URLs.

Recommend rotation only when evidence shows a credential was printed, copied into generated content, committed, pushed, or exposed outside its approved local environment.

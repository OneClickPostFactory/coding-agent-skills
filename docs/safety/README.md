# Safety

## Audit-Only Rule

`repo-map`, `route-trace`, `env-audit`, `secret-audit`, `git-preflight`, `runtime-truth`, and `llm-drift-control` must not alter project files, Git state, dependencies, processes, services, databases, remote systems, or deployment state.

`route-trace` is static only. It may read bounded non-secret route files and route
configuration, but it must not execute app code, run servers, hit URLs, claim runtime
truth, or broaden adapter scope when a project adapter is present.

`env-audit` is value-free. It may read bounded non-secret source, docs, sample, and config
files, including `.env.example`, but must not read `.env`, print values, validate
credentials, contact APIs, or inspect secret stores.

`secret-audit` is redacted static inspection only. It may read bounded non-secret static
files and report high-confidence secret-like finding paths, types, and counts, but it must
not print matched values, read `.env` or secret-bearing files, inspect credential stores,
validate or rotate credentials, contact APIs, or broaden adapter scope.

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

Project installation adds a declaration but no new permissions. Exact or ranged core pins,
adapter records, and skill IDs must agree with discovered manifests. Declaration paths remain
repository-relative, `.env` files remain outside discovery, and the declared validation
command is metadata rather than executable input.

Upgrade checks preserve that boundary across revisions. They are advisory, do not write
pins or manifests, and reject stale targets, unsupported cores, schema or skill drift,
restriction weakening, audit-mode escalation, evidence removal, failure suppression,
completion override, secret exposure, scope expansion, traversal, and symlink escape.

Compatibility-chain checks apply the same boundary to every adjacent revision and require a
current final target. They never apply upgrades. Optional evidence output is permitted only
when explicitly requested, uses a new relative `.json` file beneath a non-symlink output
base, and never overwrites existing content. Evidence omits raw project paths and project IDs.

Evidence-bundle verification is read-only. Bundle entries must stay beneath the bundle
directory, avoid local environment-file paths, avoid symlink escapes, match declared hashes,
validate against known evidence contracts, and preserve baseline status. The verifier emits
sanitized reports only and never executes commands from evidence.

Evidence retention, provenance, archive-index, and archive-report checks are also
read-only. Retention is validated as metadata only; expiry reporting is advisory and does
not delete or move files. Signed provenance is a detached-signature design and verification
planning contract, not a private-key operation and not live signature verification. Archive
indexes and reports are sanitized metadata summaries unless a future milestone separately
approves storage.

## Maintainer Loop

The local maintainer loop is a bounded repository coordinator. It may read repository Git
state, tags, the roadmap, changelog, and work ledger; run local validators; select the next
declared milestone; and append evidence to the repository-owned ledger files.

Permission flags are explicit gates. They do not authorize new skills, real project
adapters, external project changes, infrastructure work, credential access, policy
weakening, or destructive Git operations.

### Stop Boundaries

The runner stops when the worktree is dirty, validation fails, no permission matches the
next action, scope is blocked by the ledger, or human approval is required. It does not read
local environment files, publish releases, apply database changes, mutate services, or
perform deployment work.

## Command Policy Limits

Command policies declare executable families, argument strategy, parser invariants, composition rules, and denied categories. Property-style tests exercise obvious bypass combinations, but the parser is not a complete shell implementation. Unsupported syntax fails closed.

## Restricted Evidence

Historical or extracted restricted commands may inform deny rules and warnings. They must not be copied into recommended procedures, examples, templates, or adapters.

## Secret Handling

Never reproduce tokens, credentials, cookies, private keys, service-role values, or authenticated headers. Record only the secret type and affected location.

Local `.env` files may intentionally provide credentials for separately approved authenticated operations. Load them without shell tracing, reference environment-variable names rather than literal values, and avoid output that may reveal credentials. Never commit `.env` files or place credentials in remote URLs.

Recommend rotation only when evidence shows a credential was printed, copied into generated content, committed, pushed, or exposed outside its approved local environment.

# Project-Owned Adapter Installation

A future project repository owns its adapter manifests while the shared repository owns
schemas, skill manifests, command policies, completion rules, and validators. Installation
means declaring and validating that relationship; it does not copy or execute adapter code.

## Required Layout

Choose one supported adapter root:

```text
.coding-agent/adapters/
coding-agent/adapters/
adapters/coding-agent/
```

Each immediate child directory contains one `adapter.json`. The project must also contain
exactly one declaration:

```text
.coding-agent/skills.json
coding-agent.skills.json
```

Two declarations are ambiguous and fail validation.

## Declaration Contract

The declaration validates against
[`project-adapter-installation.schema.json`](../../schemas/project-adapter-installation.schema.json).
It records:

- Declaration and adapter schema versions.
- Project ID and one supported adapter root.
- Expected shared core version and an exact pin or compatible range.
- Compatible pilot skill IDs.
- Every installed adapter ID, adapter version, and skill set.
- The validation command template.
- A repository-relative evidence output location.
- A repository-relative approval policy reference.
- An explicit `noSecrets: true` guarantee.

The validation command is declared as:

```text
node <shared-core>/scripts/validate-project-adapters.mjs <project-root>
```

The validator checks this field; it does not execute it.

## Version Pinning

Two version pin forms are supported:

```text
0.2.3
>=0.2.2 <0.3.0
```

The expected version must equal the running shared core version. The pin must contain both
that version and the declared expected version. Missing versions, prefixes, wildcards,
caret ranges, unsupported old or future versions, and malformed comparators fail closed.

Adapter schema version `1.0.0` and every declared adapter version must match the discovered
manifest. Skill IDs and modes must remain compatible with the shared pilot manifests.

## Validation Flow

Run:

```bash
node scripts/validate-project-adapters.mjs <project-root>
```

The dependency-free validator:

1. Finds exactly one project declaration.
2. Validates declaration structure and safe relative paths.
3. Checks the current core version against the exact pin or compatible range.
4. Runs bounded external adapter discovery.
5. Matches project ID, adapter root, adapter IDs, versions, and skill IDs.
6. Applies shared schema, command-policy, inheritance, and path-safety checks.
7. Returns counts and stable rejection codes without echoing declaration values.

Exit `0` means the project declaration and all installed adapters are compatible. Exit `1`
means validation failed. Exit `2` means the project-root argument is missing.

## Adapter-Aware Consumption

After validation passes, a project-owned adapter can be consumed as read-only `repo-map`
context:

```bash
node scripts/render-adapter-repo-map.mjs <project-root>
```

The renderer uses the same project declaration and adapter validation path before it reads
adapter metadata. It requires `repo-map` compatibility and then renders:

- Documentation precedence.
- Safe read paths.
- Ignored paths.
- Required evidence.
- Root markers, declared scope, and detection depth.
- Package-manager hints.
- Sanitized Git branch state and warnings.

The renderer is metadata-only. It does not read target project file contents, run target
project tests, run builds, install packages, perform runtime checks, deploy, migrate, read
`.env` files, or modify project state.

A project-owned adapter can also enable read-only `route-trace` context:

```bash
node scripts/render-route-trace.mjs <project-root>
```

The route-trace renderer validates the project declaration when present. If the adapter is
present but does not enable `route-trace`, it reports an adapter-limited skip. When enabled,
it reads only adapter-declared safe paths and reports verified route files, inferred route
patterns, skipped paths, and not-verified runtime-dependent route classes. It does not run
servers, hit URLs, execute app code, build, test, deploy, migrate, inspect databases, read
`.env` files, or modify project state.

A project-owned adapter can also enable read-only `env-audit` context:

```bash
node scripts/render-env-audit.mjs <project-root>
```

The env-audit renderer validates the project declaration when present. If the adapter is
present but does not enable `env-audit`, it reports an adapter-limited skip. When enabled,
it reads only adapter-declared safe paths, refuses `.env` and secret-bearing files, and
reports environment variable names without values.

A project-owned adapter can also enable read-only `secret-audit` context:

```bash
node scripts/render-secret-audit.mjs <project-root>
```

The secret-audit renderer validates the project declaration when present. If the adapter
is present but does not enable `secret-audit`, it reports an adapter-limited skip. When
enabled, it reads only adapter-declared safe paths, refuses `.env` and secret-bearing
files, and reports high-confidence finding paths, types, and counts without matched
values or credential validation.

A project-owned adapter can also enable read-only `api-contract-audit` context:

```bash
node scripts/render-api-contract-audit.mjs <project-root>
```

The API contract audit renderer validates the project declaration when present. If the
adapter is present but does not enable `api-contract-audit`, it reports an adapter-limited
skip. When enabled, it reads only adapter-declared safe paths and reports static contract
files, endpoint declarations, client-call patterns, schema/type files, and not-verified
runtime behavior without running servers, calling APIs, or generating code.

A project-owned adapter can also enable read-only `migration-review` context:

```bash
node scripts/render-migration-review.mjs <project-root>
```

The migration review renderer validates the project declaration when present. If the
adapter is present but does not enable `migration-review`, it reports an adapter-limited
skip. When enabled, it reads only adapter-declared safe paths and reports static migration
files, schema/config files, package script keys, static risk indicators, and not-verified
database behavior without connecting to databases, applying migrations, generating ORM
clients, or running package scripts.

A project-owned adapter can also enable read-only `github-handoff` context:

```bash
node scripts/render-github-handoff.mjs <project-root>
```

The GitHub handoff renderer validates the project declaration when present. If the adapter
is present but does not enable `github-handoff`, it reports an adapter-limited skip.
When enabled, it reports local Git metadata and changed-file summaries without printing
remote URLs, reading tokens, creating pull requests, committing, pushing, tagging, calling
GitHub APIs, or changing project files.

## Safety Boundary

Project adapters are extension-only. They cannot remove denied operations, change an
audit-only mode, add deployment or publication, suppress failures, redefine completion,
remove evidence, expose secrets, expand scope without approval, or escape through symlinks
or traversal.

The validator reads only the declaration, discovered `adapter.json` files, and shared core
metadata. It ignores unrelated `.env` files and never installs packages, runs adapter
commands, deploys, migrates, or changes project state.

Use [the upgrade checker](upgrades.md) to compare a current declaration with a proposed
revision and detect stale pins or compatibility drift before adoption.

Before any real project adapter is created, use the
[real project adoption gate](real-project-adoption.md) to confirm candidate criteria,
required evidence, approval gates, stop conditions, and rollback boundaries.

All committed project roots in this shared repository remain disposable synthetic fixtures.
The first external project-owned adapter was adopted in
`/home/oneclickwebsitedesignfactory/tax-lien-platform` at candidate commit
`c548b1a6cbb3455a70b89d0e301e22435bfccac9`. The shared repository still owns the schemas,
completion rules, command policy, and validators; the project repository owns its adapter
manifest and declaration.

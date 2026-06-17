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

All committed project roots in v0.2.3 are disposable synthetic fixtures. No real project
adapter or real project repository is modified.

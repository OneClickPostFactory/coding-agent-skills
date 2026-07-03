# Route Trace Adapter Interface

Project adapters may enable `route-trace` only as an audit-only static inspection skill.

Adapters may provide:

- `safeReadPaths` for route-bearing source and route config files.
- `ignoredPaths` for generated output, dependency folders, and non-route surfaces.
- `documentationPrecedence` for route documentation that should be reviewed separately.
- `requiredEvidence` such as route files inspected, adapter scope, skipped paths, and not-verified runtime classes.
- `expectedPackageManagers` as metadata only.

Adapters must not:

- Add commands for `route-trace`.
- Permit builds, tests, package installs, server startup, URL probing, deployment, migration, database inspection, or secret reads.
- Remove inherited restrictions.
- Change `route-trace` from `audit-only` to action-capable.
- Expand scanning outside the declared project root without named approval.
- Suppress skipped checks, warnings, uncertainty, or completion requirements.

Adapters may enable `migration-review` only as an audit-only static inspection skill.

Allowed adapter extensions:

- `safeReadPaths` for migration, schema, config, and relevant package files.
- `ignoredPaths` for generated, dependency, build, coverage, and output directories.
- `documentationPrecedence` for migration runbooks or schema docs.
- `requiredEvidence` for migration files, schemas, config, risk indicators, and not-verified areas.

Adapters must not:

- Add commands for `migration-review`.
- Require database connections, migration execution, ORM generation, or package scripts.
- Include `.env`, credential, service-key, or secret-bearing paths.
- Change `migration-review` from `audit-only` to action-capable.
- Expand scope outside the declared project root without named approval.

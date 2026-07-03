Safe examples:

```bash
coding-agent-skills migration-review /workspace/app
```

```bash
node scripts/render-migration-review.mjs tests/fixtures/migration-review/static-project
```

Expected result: a report listing static migration files, schema/config files, package
script keys, risk indicators, skipped paths, not-verified database behavior, and refused
actions.

## Unsafe Examples

- Apply database migrations.
- Connect to a local or remote database to inspect applied state.
- Generate ORM clients or migration files.
- Read `.env`, credentials, service keys, or private runtime config.

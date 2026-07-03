# Migration Review Workflow

Use `coding-agent-skills migration-review <project-root>` to map static migration, schema,
config, package-script-key, and risk-indicator evidence before database work.

The workflow remains read-only: no database connections, migration execution, ORM generation,
package installation, builds, tests, deployments, secret-file reads, or project writes.

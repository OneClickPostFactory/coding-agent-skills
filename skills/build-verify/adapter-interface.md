# Project Adapter Interface

Validate adapters against `../../schemas/project-adapter.schema.json` and confirm manifest compatibility before applying them.

An adapter may declare package manager, manifest paths, validation script aliases, safe test selectors, check order, timeouts, generated-output expectations, and checks required for specific scopes.

It must not permit installation, auto-fix, snapshot updates, deployment, migration, privileged APIs, or suppression of failed/skipped checks. Shared safety and completion rules win.

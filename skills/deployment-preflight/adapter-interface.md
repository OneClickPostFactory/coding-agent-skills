# Deployment Preflight Adapter Interface

Adapters may narrow the static scan by declaring:

- `extensions.safeReadPaths`
- `extensions.ignoredPaths`
- `extensions.documentationPrecedence`
- `extensions.requiredEvidence`
- `extensions.expectedPackageManagers`

Adapters must declare `deployment-preflight` with `declaredMode: "audit-only"` and
compatible core versions. They cannot allow deployments, provider API calls, package
installs, builds, tests, runtime checks, migrations, secret reads, project writes, failure
suppression, completion overrides, or scope expansion without approval.

If a project adapter is present but does not enable `deployment-preflight`, the skill reports
`partial` and does not read target files.

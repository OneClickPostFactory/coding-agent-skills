# Deployment Preflight Failure Modes

- The project root cannot be established.
- A project adapter is present but invalid or does not enable `deployment-preflight`.
- Deployment config is absent, generated, or outside the approved scan scope.
- Files are skipped because they are secret-bearing, oversized, symlinked, generated, or ignored.
- A request asks for provider state, deployment execution, runtime health, credential checks, or build verification.

Recover by reporting partial evidence and clear uncertainty. Do not recover by deploying,
calling provider APIs, installing packages, building, testing, running services, widening
scope, or reading secrets.

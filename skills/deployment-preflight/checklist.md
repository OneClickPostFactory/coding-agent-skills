# Deployment Preflight Checklist

- Confirm the project root, branch state, adapter state, and declared scan scope.
- Validate the project adapter before consuming adapter-declared paths.
- Exclude `.env`, secret-bearing, generated, dependency, build, runtime-output, and oversized files.
- Report deployment config files, deployment docs, package script keys, platform indicators, risk indicators, skipped items, and not-verified areas.
- Confirm no deployment, provider API call, package install, build, test, runtime check, migration, secret read, project write, or Git mutation occurred.

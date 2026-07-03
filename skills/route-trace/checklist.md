# Route Trace Checklist

- Confirm project root and declared scope.
- Validate any project adapter before consuming adapter metadata.
- If the adapter is present but does not enable `route-trace`, stop and report the adapter-limited skip.
- Build a bounded static scan scope from adapter safe paths or generic repository-local defaults.
- Exclude `.env`, secret-bearing files, generated output, dependencies, and ignored paths.
- Identify verified route files separately from inferred route declarations.
- Record skipped paths and not-verified runtime-dependent route classes.
- State that no server, build, test, runtime check, deployment, migration, package install, or secret read was performed.
- Emit an evidence pack or route-trace report before claiming completion.

# Route Trace Workflow

Use `route-trace` when the route surface must be understood from static files before
editing or review.

```bash
coding-agent-skills route-trace /path/to/project
```

Expected evidence:

- validated adapter state when present
- adapter-limited or generic static scan scope
- verified route files
- inferred route declarations
- skipped paths and not-verified runtime-dependent route classes
- no state changes

Do not run servers, hit URLs, read `.env`, install packages, build, test, deploy, migrate,
or claim runtime availability from static route findings.

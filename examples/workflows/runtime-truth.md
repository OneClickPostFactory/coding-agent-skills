# Runtime Truth Workflow

**Intent:** Determine whether a local service is running, listening, reachable, and healthy.

1. Record expected process, manager, port, and safe health endpoint.
2. Inspect manager status.
3. Inspect matching processes.
4. Inspect the expected listener and owner.
5. Call only the unauthenticated local health endpoint.
6. Correlate all layers and report contradictions.

```bash
ss -lntp
curl -sS http://127.0.0.1:3000/health
```

**Unsafe and denied:** lifecycle changes, signals, deployment, secret loading, and authenticated endpoints.

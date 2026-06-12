---
name: runtime-truth
description: Audit what is actually running by correlating process-manager status, process identity, network listeners, and unauthenticated health endpoints. Use when configured, deployed, running, reachable, and healthy states may differ; never start, stop, restart, enable, kill, deploy, load secrets, or call authenticated or privileged APIs.
---

# Runtime Truth

Distinguish configuration from observed runtime state. Remain audit-only.

## Purpose And Use

Use when configured, deployed, running, listening, reachable, and healthy may differ. Do not use to start, repair, restart, deploy, authenticate, or administer the runtime.

## Inputs

Require the service or process hint and intended environment. Optionally accept expected port, local unauthenticated health URL, process manager, expected executable, and project adapter.

Do not assume a configured service is running, a running process owns the expected port, a listener is healthy, or a successful HTTP response came from the intended build.

## Command Policy

Permit bounded status inspection:

- process listings filtered to the named service
- listener inspection for expected ports
- `systemctl status` or `systemctl --user status`
- `pm2 list` or equivalent status-only views
- container status inspection without lifecycle changes
- unauthenticated `http://127.0.0.1` or explicitly approved public health checks

Do not start, stop, restart, reload, enable, disable, kill, signal, deploy, tail unbounded logs, source `.env`, print environment values, or call authenticated or privileged endpoints.

This is audit-only behavior. A status tool is allowed only in its non-mutating form.

## Procedure

1. Record expected service, manager, executable, port, and health endpoint.
2. Inspect configured status without changing manager state.
3. Inspect matching processes and start times.
4. Inspect expected listeners and owning processes.
5. Call only safe unauthenticated health endpoints.
6. Correlate manager, process, listener, and HTTP evidence.
7. Classify configured, stopped, running, listening, reachable, healthy, degraded, conflicting, or unverifiable state.
8. Emit the shared evidence pack.

Use [checklist.md](checklist.md), [failure-modes.md](failure-modes.md), [adapter-interface.md](adapter-interface.md), [examples.md](examples.md), and [evidence-template.md](evidence-template.md).

## Evidence, Recovery, And Dependencies

Emit manager, process, listener, health, timestamp, contradiction, inaccessible-layer, confidence, and changed-state evidence. Recover from unavailable managers, permissions, ownership ambiguity, or authentication requirements by checking remaining read-only layers and lowering confidence; never mutate or load secrets.

Depend on repository/runtime identity inputs and the evidence-pack contract; `repo-map` evidence is useful but optional. Adapters may add status-only commands and safe health endpoints but cannot add lifecycle actions. Safe usage checks a local health endpoint and listener; unsafe usage restarts a service or loads credentials.

## Approval Boundary

Named approval may allow one non-secret log or public health location. It does not permit service mutation, secret loading, authenticated APIs, or process signals.

## Completion

Claim `complete` only when all applicable runtime layers were checked or safely declared unavailable, contradictions are reported, and no state changed. Otherwise use `partial`, `failed`, or `blocked`.

These conditions are both the acceptance criteria and definition of done.

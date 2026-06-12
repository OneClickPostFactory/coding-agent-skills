# Failure Modes

| Failure | Recovery |
|---|---|
| Manager is unavailable | Inspect process/listener layers and lower confidence |
| Permission denied | Do not escalate automatically; record inaccessible evidence |
| Expected port has another owner | Report conflict without terminating it |
| Health endpoint requires authentication | Skip it; do not load secrets |
| HTTP succeeds but process identity is unclear | Classify reachable but ownership unverifiable |
| Manager says running but no listener exists | Classify degraded or contradictory |
| Endpoint times out | Record failure and preserve other layer evidence |

Recovery never changes runtime state.

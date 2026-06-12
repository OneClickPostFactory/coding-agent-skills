# Failure Modes

| Failure | Recovery |
|---|---|
| Claim is too broad | Split it into atomic statements |
| Sources disagree | Preserve both and classify contradiction |
| Authoritative source is unknown | Use adapter precedence or report unverifiable |
| Evidence is from another branch | Mark scope mismatch |
| Documentation is generated | Trace to its source when available |
| Tests exist but were not run | Treat them as implementation evidence, not passing evidence |
| Runtime evidence is stale | Lower confidence and record timestamp |

Never resolve uncertainty by inventing a preferred truth.

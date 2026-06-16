# Work Ledger

## Current State

- Repository: `coding-agent-skills`
- Branch: `main`
- Pilot skills: `repo-map`, `build-verify`, `git-preflight`, `runtime-truth`, `llm-drift-control`
- Adapter discovery, project adapter installation, stale-pin detection, upgrade evidence, compatibility-chain validation, evidence-bundle verification, retention policy, provenance design, and archive-report rendering are implemented.
- Real project adapters are not implemented.
- New skills are not approved.

## Last Completed Version

`v0.2.2`

## Current Recommended Milestone

Evidence-bundle archive index fixtures, retention-expiry advisory reporting, and detached-signature verification planning.

## Allowed Next Actions

- Inspect local repository state.
- Read `ROADMAP.md`, `CHANGELOG.md`, and this ledger.
- Run pack validation.
- Run release tests.
- Run maintainer-loop validation.
- Select the next bounded milestone.
- Write maintainer-loop evidence to `runs/skill-runs.md`.
- Update this ledger with local maintainer decisions.

## Blocked Actions

- Adding new skills.
- Creating real project adapters.
- Modifying real project repositories.
- Publishing release artifacts without explicit approval.
- Adding dependencies without explicit approval.
- Weakening safety, adapter, evidence, command-policy, or completion rules.
- Running infrastructure, database, service, or process mutations.

## Evidence Required

- Current branch and tag summary.
- Clean or dirty Git state.
- Validation commands and results.
- Selected milestone and required permission.
- Files changed by the maintainer-loop run.
- Stop boundary reached.
- Recommended next action.

## Stop Conditions

- Working tree is dirty before the loop starts.
- No permission flag is supplied.
- Supplied permission does not match the next required action.
- Validation fails.
- The next action would exceed the approved repository scope.
- The next action requires human approval.

## Human Approval Required For

- Implementing the next evidence-retention or provenance milestone.
- Creating, changing, or removing skills.
- Adding real project adapters.
- Touching real project repositories.
- Changing release publication behavior.
- Commit, tag, or push operations.
- Any action not listed in the allowed next actions above.

## Next Run Command

```bash
./scripts/run-next --allow evidence-harness
```

## Maintainer Decisions

No autonomous maintainer-loop run has been recorded yet.


### 2026-06-15T21:02:34.116Z

- Latest tag observed: `v0.2.0`
- Selected milestone: Evidence-bundle verification, deterministic replay, and cross-release compatibility regression reporting.
- Required permission: `evidence-harness`
- Validation result: pass
- Stop boundary: implementation requires human approval


### 2026-06-16T12:16:32Z

- Latest tag observed: `v0.2.0`
- Implemented milestone: Evidence-bundle verification, deterministic replay, and cross-release compatibility regression reporting.
- Required permission: `evidence-harness`
- Validation result: pass
- Next recommended milestone: Evidence-bundle retention policy, signed provenance design, and report archival hardening.


### 2026-06-16T11:48:47.963Z

- Latest tag observed: `v0.2.1`
- Selected milestone: Evidence-bundle retention policy, signed provenance design, and report archival hardening.
- Required permission: `evidence-harness`
- Validation result: pass
- Stop boundary: implementation requires human approval


### 2026-06-16T00:00:00Z

- Latest tag observed: `v0.2.1`
- Implemented milestone: Evidence-bundle retention policy, signed provenance design, and report archival hardening.
- Required permission: `evidence-harness`
- Validation result: pass
- Next recommended milestone: Evidence-bundle archive index fixtures, retention-expiry advisory reporting, and detached-signature verification planning.

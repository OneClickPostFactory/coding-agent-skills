# Work Ledger

## Current State

- Repository: `coding-agent-skills`
- Branch: `main`
- Pilot skills: `repo-map`, `route-trace`, `env-audit`, `secret-audit`, `api-contract-audit`, `migration-review`, `github-handoff`, `deployment-preflight`, `build-verify`, `git-preflight`, `runtime-truth`, `llm-drift-control`
- Adapter discovery, project adapter installation, stale-pin detection, upgrade evidence, compatibility-chain validation, evidence-bundle verification, retention policy, provenance design, archive-report rendering, archive-index fixtures, retention-expiry advisory reporting, and detached-signature verification planning are implemented.
- Real-project adapter adoption readiness is documented as a planning-only approval gate.
- First external project-owned adapter adoption completed for `/home/oneclickwebsitedesignfactory/tax-lien-platform` at candidate commit `c548b1a6cbb3455a70b89d0e301e22435bfccac9`.
- The adopted adapter is `repo-map` only, docs/metadata-only, and contains no commands, runtime checks, build/test/package behavior, platform/deployment behavior, or secret-aware behavior.
- The shared repository does not contain real adapter manifests; real project adapters remain owned by their project repositories.
- Public npm package release target `v0.2.18` exposes the dependency-free
  `coding-agent-skills` CLI under MIT license.
- `v0.2.18` formalizes the public JSON result schema, corrects missing-input and
  safety-refusal semantics, and adds deterministic aggregate `audit` output.
- `route-trace` is implemented as an audit-only static route tracing skill.
- `env-audit` is implemented as an audit-only value-free environment variable name mapping
  skill.
- `secret-audit` is implemented as an audit-only redacted secret exposure detection skill.
- `api-contract-audit` is implemented as an audit-only static API contract surface mapping
  skill.
- `migration-review` is implemented as an audit-only static migration and schema evidence
  review skill.
- `github-handoff` is implemented as an audit-only local Git handoff evidence skill.
- `deployment-preflight` is implemented as an audit-only static deployment readiness
  evidence skill.
- Builder-mode approval: complete the remaining read-only skill wave for
  `coding-agent-skills` itself. Real-world project execution constraints remain unchanged.

## Last Completed Version

`v0.2.18` (release validation in progress)

## Current Recommended Milestone

The formal public CLI result schema and aggregate read-only audit command are the current
release milestone. After `v0.2.18` is published and the OpenClaw wrapper exposes
`coding_audit`, reassess the next read-only capability from current repository evidence.

## Allowed Next Actions

- Inspect local repository state.
- Read `ROADMAP.md`, `CHANGELOG.md`, and this ledger.
- Run pack validation.
- Run release tests.
- Run maintainer-loop validation.
- Select the next bounded milestone.
- Maintain planning documentation for the approved real-project adapter adoption gate.
- Write maintainer-loop evidence to `runs/skill-runs.md`.
- Update this ledger with local maintainer decisions.
- Record completed real-project adapter adoption evidence in shared docs and run logs.
- Maintain public package metadata and release evidence for approved patch releases.

## Blocked Actions

- Adding skills outside the approved builder-mode read-only wave.
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
- Selecting a real project adapter candidate.
- Gathering evidence from a real project repository.
- Creating, changing, or removing skills outside the approved builder-mode read-only wave.
- Adding real project adapters.
- Expanding the adopted `tax-lien-platform` adapter beyond `repo-map`.
- Enabling candidate repo package scripts, build verification, runtime checks, or command aliases.
- Allowing or bypassing project Git hooks during future adapter publication.
- Touching real project repositories.
- Changing release publication behavior.
- Publishing a new npm version outside the approved builder-mode read-only wave or another
  explicitly approved release.
- Commit, tag, or push operations.
- Any action not listed in the allowed next actions above.

## Next Run Command

```bash
No next runner command is currently queued.
```

## Maintainer Decisions

No autonomous maintainer-loop run has been recorded yet.

### 2026-07-03T13:00:00Z

- Latest tag observed: `v0.2.13`
- Implemented milestone: `github-handoff` audit-only local Git handoff evidence skill and CLI command.
- Required permission: `builder-mode-skill-implementation`
- Validation result: passed; `v0.2.14` commit, tag, npm publication, registry smoke, npm exec, and GitHub Release completed
- Next recommended milestone: continue builder-mode wave with `deployment-preflight-skill`
  after `v0.2.14` publication completes.

### 2026-07-03T14:00:00Z

- Latest tag observed: `v0.2.14`
- Implemented milestone: `deployment-preflight` audit-only static deployment readiness
  evidence skill and CLI command.
- Required permission: `builder-mode-skill-implementation`
- Validation result: passed; `v0.2.15` commit, tag, npm publication, registry smoke,
  npm exec, and GitHub Release completed
- Next recommended milestone: implement the OpenClaw-compatible JSON output and exit-code
  contract before continuing to `cloudflare-preflight-skill`.

### 2026-07-03T15:00:00Z

- Latest tag observed: `v0.2.15`
- Implemented milestone: OpenClaw-compatible optional `--json` output and documented
  exit-code semantics for every public CLI command.
- Required permission: `orchestrator-output-contract`
- Validation result: pass pending final release validation matrix
- Next recommended milestone: continue builder-mode wave with `cloudflare-preflight-skill`
  after `v0.2.16` publication completes.

### 2026-07-11T00:00:00Z

- Latest tag observed: `v0.2.17`
- Implemented milestone: formal public CLI result schema, corrected missing-project and
  unsafe-adapter exit semantics, and deterministic aggregate `audit` command.
- Required permission: approved end-to-end package and OpenClaw integration release.
- Validation result: source, fixture, schema, tarball, and temporary installed-package
  checks passed; registry, npm exec, and OpenClaw plugin checks remain after publication.
- Next recommended milestone: select from current evidence after `v0.2.18` publication
  and `coding_audit` registration complete.

### 2026-07-03T12:00:00Z

- Latest tag observed: `v0.2.12`
- Implemented milestone: `migration-review` audit-only static migration and schema evidence review skill and CLI command.
- Required permission: `builder-mode-skill-implementation`
- Validation result: passed; `v0.2.13` commit, tag, npm publication, registry smoke, npm exec, and GitHub Release completed
- Next recommended milestone: continue builder-mode wave with `github-handoff-skill`
  after `v0.2.13` publication completes.


### 2026-07-03T12:00:00Z

- Latest tag observed: `v0.2.11`
- Implemented milestone: `api-contract-audit` audit-only static API contract surface mapping skill and CLI command.
- Required permission: `builder-mode-skill-implementation`
- Validation result: pass pending final publication evidence
- Next recommended milestone: continue builder-mode wave with `migration-review-skill`
  after `v0.2.12` publication completes.


### 2026-07-03T11:00:00Z

- Latest tag observed: `v0.2.10`
- Implemented milestone: `secret-audit` audit-only redacted secret exposure detection skill and CLI command.
- Required permission: `builder-mode-skill-implementation`
- Validation result: pass pending final publication evidence
- Next recommended milestone: continue builder-mode wave with `api-contract-audit-skill`
  after `v0.2.11` publication completes.


### 2026-07-03T10:00:00Z

- Latest tag observed: `v0.2.9`
- Implemented milestone: `env-audit` audit-only environment variable name mapping skill and CLI command.
- Required permission: `builder-mode-skill-implementation`
- Validation result: pass pending final publication evidence
- Next recommended milestone: continue builder-mode wave with `secret-audit-skill` after
  `v0.2.10` publication completes.


### 2026-06-19T00:00:00Z

- Latest tag observed: `v0.2.7`
- Implemented milestone: Public npm release for `coding-agent-skills`.
- Required permission: `release-preflight`
- Validation result: pass pending final publication evidence
- Next recommended milestone: No next runner command is queued; future package
  publication, new skills, real adapter expansion, platform work, and deployment/preflight
  skills require separate human approval.


### 2026-07-03T00:00:00Z

- Latest tag observed: `v0.2.8`
- Implemented milestone: `route-trace` audit-only static route tracing skill and CLI command.
- Required permission: `skill-implementation`
- Validation result: pass pending final publication evidence
- Next recommended milestone: no next runner command is queued; future real adapter
  expansion, new skills, platform work, deployment/preflight skills, and release-policy
  changes require separate human approval.


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


### 2026-06-16T22:56:07.929Z

- Latest tag observed: `v0.2.2`
- Selected milestone: Evidence-bundle archive index fixtures, retention-expiry advisory reporting, and detached-signature verification planning.
- Required permission: `evidence-harness`
- Validation result: pass
- Stop boundary: implementation requires human approval


### 2026-06-17T00:00:00Z

- Latest tag observed: `v0.2.2`
- Implemented milestone: Evidence-bundle archive index fixtures, retention-expiry advisory reporting, and detached-signature verification planning.
- Required permission: `evidence-harness`
- Validation result: pass
- Next recommended milestone: human direction required before selecting the next bounded milestone.

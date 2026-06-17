# Real Project Adapter Adoption Gate

This document defines the planning gate for a future first real project adapter. It does
not approve creating that adapter, modifying a project repository, or changing the shared
skill pack's safety model.

The shared repository is ready to evaluate a candidate because it already has bounded
adapter discovery, project-owned installation declarations, version pinning, upgrade
checks, compatibility-chain checks, evidence contracts, and release validation. That
readiness is a gate, not implementation permission.

## Candidate Selection Criteria

A first real project adapter candidate must satisfy all of these conditions before any
project repository is touched:

- The project owner explicitly approves an adapter-planning review for that repository.
- The project has a stable repository root and an identifiable owning project.
- The project can use one supported adapter location:
  `.coding-agent/adapters/`, `coding-agent/adapters/`, or `adapters/coding-agent/`.
- The project can declare exactly one installation file: `.coding-agent/skills.json` or
  `coding-agent.skills.json`.
- The adapter need is bounded to existing pilot skills: `repo-map`, `build-verify`,
  `git-preflight`, `runtime-truth`, or `llm-drift-control`.
- The adapter can narrow context with relative paths, documentation precedence, safe
  aliases, status-only hints, or extra evidence requirements.
- The adapter does not require deployment, migration, package installation, Git
  publication, service mutation, billing, platform credentials, or secret reads.
- The project has enough public or non-sensitive documentation to justify the adapter
  without storing raw secrets, private evidence, or local environment values.

If any condition is missing, the candidate remains deferred.

## Required Evidence Before Touching A Real Project

Before creating files in a real project repository, the operator must gather and report
sanitized evidence from this shared repository only:

- Current shared skill-pack version and tag.
- Clean or intentionally documented Git state for the shared repository.
- Candidate project name or approved placeholder, without secrets or local-only paths.
- Proposed adapter root and declaration-file location.
- Pilot skill IDs the adapter would support.
- Proposed extension type, such as read paths, documentation precedence, package-manager
  hints, status-only runtime hints, or additional evidence.
- Explicit statement that no new skill, platform workflow, deployment, migration, package
  publication, or global CLI flow is part of the adoption.
- Approval record naming whether the next step is read-only review, project-file
  scaffolding, or implementation.

This evidence must not include `.env` contents, credentials, raw command output with
private values, or private project internals.

## Required Validator Commands

Before adoption planning can move from this shared repository into a real project, the
shared pack must pass:

```bash
node scripts/validate-pack.mjs .
node scripts/test-pack.mjs
node scripts/validate-maintainer-loop.mjs .
node scripts/validate-adapters.mjs tests/fixtures/external-adapters/valid-basic
node scripts/validate-project-adapters.mjs tests/fixtures/project-adapter-installation/valid-exact-pin
node scripts/check-adapter-upgrade.mjs tests/fixtures/project-adapter-upgrades/valid-upgrade/before tests/fixtures/project-adapter-upgrades/valid-upgrade/after
node scripts/check-adapter-upgrade-chain.mjs tests/fixtures/project-adapter-upgrade-chains/valid-chain
node --test
```

After a separately approved real adapter is created in its owning project repository, run
the same shared-pack validation plus the project-specific declaration validation against
the approved project root. If an existing adapter is being changed, also run the upgrade
or compatibility-chain check against sanitized before and after revisions.

## Safety Boundaries

Project adapters remain extension-only data. They must never:

- Remove inherited denied-operation categories.
- Change an audit-only skill into an action-capable skill.
- Permit deployment, Git publication, installation, migration, service mutation, or
  privileged API calls.
- Expose secrets or add secret-bearing paths.
- Suppress failures, contradictions, dirty state, required evidence, or skipped-check
  consequences.
- Redefine completion semantics.
- Expand scanning outside the approved project root.
- Read or print `.env` files.
- Copy shared restrictions into a project in a way that allows local weakening.

The shared core remains authoritative for schemas, command policy, completion rules,
evidence contracts, and validator behavior.

## Approval Gates

The following approvals are separate:

1. Approve selecting a candidate project for adapter planning.
2. Approve read-only evidence gathering in that project.
3. Approve creating project-owned adapter files in that project.
4. Approve validating the project declaration with the shared core.
5. Approve committing or publishing project-repository adapter changes.
6. Approve changing the shared core if adoption reveals a missing generic validator rule.

Approval for one gate does not imply approval for the next gate.

## Stop Conditions

Stop immediately and report if:

- The candidate requires a new skill or platform-specific workflow.
- The candidate needs deployment, migration, package installation, Git publication, or
  service mutation.
- The candidate requires reading or exposing secrets.
- The project cannot use a supported adapter location or declaration file.
- The shared validation matrix fails.
- The adapter would weaken shared restrictions, evidence rules, command policy, or
  completion semantics.
- The project owner has not explicitly approved the current gate.
- The work would require touching a real project repository without separate approval.

## Rollback Conditions

If a separately approved project adapter later fails validation, the operator must stop
and preserve evidence. Rollback means removing or reverting the project-owned adapter
change in that project repository under that repository's approval process. This shared
repository must not silently loosen schemas, validators, or safety rules to make a real
adapter pass.

## Still Forbidden Until Separately Approved

- New skills.
- Real project adapter creation.
- Real project repository modification.
- Platform or deployment skills.
- Package publication or root package setup.
- Global CLI installation flow.
- Deployments, migrations, service mutations, or privileged API calls.
- Commit, push, tag, or release publication.
- Reading or printing `.env` contents.

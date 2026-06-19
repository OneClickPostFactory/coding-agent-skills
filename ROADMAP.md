# Roadmap

The pilot release remains limited to five approved skills. Future work requires separate design and approval.

## Released Harness Milestones

- `v0.1.0`: schemas, examples, dependency-free validation, CI, and governance.
- `v0.1.1`: trigger, command-policy, mutation, privacy, adapter, and false-completion harnesses.
- `v0.1.2`: formal adapter contract, compatibility enforcement, and property-style command-policy coverage.
- `v0.1.3`: bounded external-adapter discovery, validation, fixture roots, and path-safety enforcement.
- `v0.1.4`: project-owned installation declarations, version pins, and disposable adoption fixtures.
- `v0.1.5`: paired adapter upgrade checks, stale-pin detection, and compatibility-drift rejection.
- `v0.1.6`: structured upgrade evidence and multi-step compatibility-chain validation.
- `v0.2.0`: fail-closed local maintainer loop with an explicit work ledger, run evidence,
  permission gates, and approval stop boundaries.
- `v0.2.1`: evidence-bundle verification, deterministic replay hash, and cross-release
  compatibility regression reporting over disposable evidence fixtures.
- `v0.2.2`: evidence-bundle retention policy, detached-signature provenance design, and
  sanitized archive-report rendering.
- `v0.2.3`: synthetic evidence-bundle archive indexes, retention-expiry advisory
  reporting, and detached-signature verification planning.
- `v0.2.4`: adapter-aware `repo-map` renderer that consumes validated project-owned
  adapters.
- `v0.2.5`: local `coding-agent-skills` command surface for validated scripts.
- `v0.2.6`: npm package readiness scaffold with dependency-free package metadata.
- `v0.2.7`: package-installed `validate-pack` support for tarball/global installs.
- `v0.2.8`: first public npm release with MIT license, public metadata, and registry
  install smoke coverage.

The next milestone is recorded in [work-ledger.md](work-ledger.md). The
[maintainer loop](RUNBOOK.md) may select and evidence that milestone, but it must stop
before implementation until the relevant human approval is granted.

No evidence-harness milestone is queued after `v0.2.3`. Additional real project adapters,
new skills, platform work, deployment/preflight work, and signing infrastructure remain
separately gated. The public npm package exposes the existing read-only CLI surface; it
does not approve new skills or target-project mutation.

## Planning Gates

- Real-project adapter adoption readiness is documented as a planning-only gate. It
  defines candidate selection criteria, required pre-adoption evidence, validator commands,
  safety boundaries, approval gates, stop conditions, rollback conditions, and forbidden
  work before any real project adapter may be created.

## Real Project Adapter Adoption Evidence

- First external project-owned adapter adoption completed for
  `/home/oneclickwebsitedesignfactory/tax-lien-platform` at candidate commit
  `c548b1a6cbb3455a70b89d0e301e22435bfccac9`.
- Adopted scope: `repo-map` only, docs/metadata-only, no commands, no runtime checks, no
  build/test/package behavior, no platform/deployment behavior, and no secret-aware
  behavior.
- The shared repository still contains only shared schemas, validators, docs, examples,
  and synthetic fixtures. The real adapter lives in its owning project repository.
- Publication caveat: the candidate repository's normal pre-push hook attempted package
  operations. The run was interrupted to preserve the approved boundary, and publication
  completed with hook verification bypass after shared adapter validation and safe checks
  passed.

Next safe milestone options:

- Document a project-hook publication policy for future real adapter adoption.
- Add synthetic fixture coverage for hook-triggered publication caveats.
- Run a read-only qualification audit for a second candidate.
- Plan adapter-upgrade evidence review for the adopted `tax-lien-platform` adapter.

| Candidate | Scope | Mode | Current gate |
|---|---|---|---|
| `route-trace-skill` | General | Audit-only | Needs design review |
| `env-audit-skill` | General | Audit-only | Needs more evidence |
| `secret-audit-skill` | General | Audit-only | Blocked on privacy and approval model |
| `deployment-preflight-skill` | General | Audit-only | Needs design review |
| `cloudflare-preflight-skill` | Platform-specific | Audit-only | Needs more evidence |
| `cloudflare-deploy-skill` | Platform-specific | Action-capable | Blocked on approval model |
| `supabase-rls-audit-skill` | Platform-specific | Audit-only | Needs more evidence |
| `migration-review-skill` | General with platform adapters | Audit-only | Needs design review |
| `api-contract-audit-skill` | General | Audit-only | Needs design review |
| `repo-knowledge-sync-skill` | General | Action-capable | Blocked on write approval model |
| `security-hardening-review-skill` | General coordinator | Audit-only | Needs more evidence |
| `worker-queue-debug-skill` | General core with project adapters | Audit-only first | Needs more evidence |
| `devvit-ingest-debug-skill` | Project-specific | Audit-only | Needs project evidence |
| `github-handoff-skill` | Platform-specific | Action-capable | Blocked on approval model |
| `session-extractor-skill` | General tooling | Action-capable | Blocked on privacy policy and more evidence |
| `command-redaction-skill` | General tooling | Action-capable | Needs more evidence |

No roadmap item is implicitly approved for implementation.

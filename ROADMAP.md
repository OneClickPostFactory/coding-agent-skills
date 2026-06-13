# Roadmap

The pilot release remains limited to five approved skills. Future work requires separate design and approval.

## Released Harness Milestones

- `v0.1.0`: schemas, examples, dependency-free validation, CI, and governance.
- `v0.1.1`: trigger, command-policy, mutation, privacy, adapter, and false-completion harnesses.
- `v0.1.2`: formal adapter contract, compatibility enforcement, and property-style command-policy coverage.

The next milestone should exercise the formal adapter contract in disposable external fixture repositories and define a safe installation/discovery test harness before any new skill is approved.

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

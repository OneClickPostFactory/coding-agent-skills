# Harness

The v0.1.x harness is dependency-free and runs through:

- `node scripts/validate-pack.mjs .`
- `node scripts/test-pack.mjs`
- `node --test`

## Trigger Classification

Synthetic prompts identify the least-privileged matching pilot skill and reject mutation or publication requests. The classifier is a harness oracle, not a production router.

## Command Policy

The command analyzer handles obvious composition, multiline scripts, pipelines, wrappers, heredocs, redirects, project scripts, Git, curl, runtime status commands, and restricted arguments. It is intentionally conservative and is not a complete POSIX parser.

## Mutation Snapshots

Audit-only Markdown is scanned for restricted commands presented as procedures. Commands in explicitly denied or negative contexts remain documentation. Synthetic snapshot targets are hashed before and after checks.

## Privacy And Redaction

Sensitive shapes are stored as ordered synthetic parts and reconstructed only in memory. Tests verify type detection, redaction, and absence from reusable skill content without printing fixture values.

## Adapter Weakening

Valid adapters may narrow paths and add safe context. Tests reject deployment, Git publication, failure suppression, completion overrides, secret exposure, missing restrictions, and audit-mode overrides.

## False Completion

Schema-valid evidence still fails semantic completion when required consequences, successful commands, material-risk resolution, known state, confidence reasons, repository identity, or supporting evidence are missing.

Fixtures live under `tests/fixtures/`. Focused test documentation records both implemented checks and future extensions.

# Contributing

## Before Adding A Skill

1. Establish repeated, safe, generalizable evidence.
2. Classify the skill as audit-only or action-capable.
3. Define approval boundaries before command procedures.
4. Keep platform and project behavior outside general skills.
5. Obtain explicit scope approval.

## Required Skill Shape

Initialize skills with the official skill creator and include:

- `SKILL.md`
- `agents/openai.yaml`
- `checklist.md`
- `examples.md`
- `failure-modes.md`
- `adapter-interface.md`
- `evidence-template.md`

Add a manifest example, command-policy example, evidence-pack example, workflow example, and executable tests.

## Safety Rules

- Never copy restricted evidence into reusable procedures.
- Never commit secrets or local `.env` files.
- Audit-only skills cannot gain mutation through adapters or approval.
- Action-capable skills must enumerate permitted local actions and reject everything else.
- Failed or skipped required checks cannot produce `complete`.

## Validation

Run:

```bash
node scripts/validate-pack.mjs .
node scripts/test-pack.mjs
node scripts/validate-maintainer-loop.mjs .
node --test
```

Update the changelog and roadmap when behavior or scope changes.

## Maintainer Loop

`./scripts/run-next --allow <permission>` may inspect local repository state, validate the
pack, select the next ledger milestone, and append bounded run evidence. It must start from
a clean worktree and fails closed for missing, unknown, or mismatched permissions.

The loop does not replace human approval for scope changes, new skills, real adapters,
release publication, dependencies, or weakened safety rules. Update `work-ledger.md` when
the approved next milestone or its stop conditions change.

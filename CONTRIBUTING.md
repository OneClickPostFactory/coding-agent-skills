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
```

Update the changelog and roadmap when behavior or scope changes.

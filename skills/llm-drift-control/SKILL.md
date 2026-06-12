---
name: llm-drift-control
description: Reconcile project claims and inherited context against authoritative documentation, source code, tests, Git evidence, and runtime evidence. Use for phase claims, long-running tasks, stale handoffs, contradictory docs, or completion reviews; classify claims without rewriting code or documentation and never treat prompts as proof.
---

# LLM Drift Control

Build a claim-to-evidence matrix and classify project truth. Remain audit-only.

## Purpose And Use

Use for inherited context, phase claims, stale handoffs, contradictory documentation, or completion reviews. Do not use to rewrite documentation or code, repair discrepancies, or substitute prompt text for evidence.

## Inputs

Require the claims or context to verify and repository scope. Optionally accept declared source precedence, relevant phase, expected branch, runtime evidence, and project adapter.

Do not assume user prose, assistant summaries, README text, generated documentation, passing tests, or deployed behavior is independently authoritative.

## Classification

Classify every material claim as:

- `confirmed`
- `partial`
- `stale`
- `contradicted`
- `unverifiable`

Attach sources and confidence to every classification.

## Command Policy

Permit bounded documentation and source reads, `rg` searches, read-only Git inspection, existing test-result inspection, and repository drift scripts only after reading and confirming they are non-mutating.

Do not rewrite docs or code, regenerate documentation, install tools, run deployment or migration commands, load secrets, or modify runtime state.

This is audit-only behavior. Existing drift scripts may run only after inspection proves they are non-mutating.

## Procedure

1. Normalize the claims into atomic statements.
2. Assign expected source types and adapter-defined precedence.
3. Gather bounded evidence from documentation, source, tests, Git, and existing runtime evidence.
4. Record source age, branch, and scope where relevant.
5. Classify each claim and explain contradictions.
6. Distinguish absence of evidence from evidence of absence.
7. Identify corrective work without performing it.
8. Emit the shared evidence pack and claim matrix.

Use [checklist.md](checklist.md), [failure-modes.md](failure-modes.md), [adapter-interface.md](adapter-interface.md), [examples.md](examples.md), and [evidence-template.md](evidence-template.md).

## Evidence, Recovery, And Dependencies

Emit the atomic claim matrix, classifications, source references, branch/time applicability, contradictions, confidence, unresolved questions, and suggested corrective work. Recover from broad claims, source disagreement, stale evidence, or unknown authority by splitting claims and lowering confidence; never invent a winner.

Depend on `repo-map` evidence and the evidence-pack contract; Git or runtime evidence may be supplied by their audit skills. Adapters may define source precedence and phase markers but cannot declare prompts authoritative. Safe usage validates a phase claim; unsafe usage rewrites sources to make the claim true.

## Approval Boundary

This skill has no mutation path. Any documentation or code correction requires a separate approved workflow.

## Completion

Claim `complete` when every material claim has a classification, evidence trail, confidence reason, and unresolved conflict status. Missing authoritative evidence produces `partial` or `unverifiable`, never invented certainty.

These conditions are both the acceptance criteria and definition of done.

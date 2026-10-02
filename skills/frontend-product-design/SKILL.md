---
name: frontend-product-design
description: Research-first guidance for product frontend work. Use when designing or reviewing frontend features, design systems, accessibility, performance, UX writing, or usability for a product website or app. Prefer deep research of comparable systems before locking a design document; then refine the doc and ship milestone by milestone.
---

# Frontend Product Design

Guide product frontend work with a research-first process, then a clear design document, then milestone delivery. Remain guidance- and evidence-oriented. Do not mutate the target project unless a separate action-capable skill is explicitly invoked and approved.

## Purpose And Use

Use when the agent must:
- orient on a product frontend or design-system surface
- research how large systems solved similar problems before proposing a design
- produce or refine a design document for a feature or refactor
- check accessibility, performance, UX writing, or usability considerations
- break work into clear milestones before implementation

Do not use this skill to install packages, edit source, deploy, or run mutating commands. Pair with `repo-map`, `build-verify`, or other existing skills when code changes are later required.

## Inputs

Require:
- product or feature intent
- target repository or design surface (path or identity)
- current constraints (tech stack, design system, brand, timeline)

Optionally accept:
- existing design docs or Figma links
- known comparable products or systems to research
- accessibility, performance, or content requirements
- milestone boundaries already decided by the user

Do not assume the first idea is correct, that documentation is current, or that a familiar pattern is the right fit without evidence.

## Safety Boundary

This skill is **guidance / audit-oriented**.

Allowed:
- read repository structure and existing design/docs (via `repo-map` or bounded inspection)
- research public documentation, established patterns, and published case studies
- produce or revise design documents, checklists, and milestone plans as evidence
- list accessibility, performance, UX-writing, and usability risks

Forbidden:
- write or modify application source, config, or lockfiles
- install packages or change dependencies
- run builds, tests, deploys, or migrations
- read secret-bearing files
- claim implementation complete without a separate approved action skill

## Core Workflow (Research First)

1. **Research before design doc**  
   Do not start by writing a polished design document. It is easy to believe the problem is understood when it is not.  
   Research how the largest comparable systems solved similar problems: trade-offs, failure modes, accessibility patterns, performance budgets, content models, and real constraints. Record sources and insights.

2. **Decide direction**  
   Only after research, choose the high-level approach and explicit non-goals.

3. **Write and revise the design document**  
   Produce a concise design doc covering problem, goals, non-goals, proposed solution, design-system impact, accessibility, performance, UX writing / microcopy, usability risks, and open questions. Revise until significant ambiguities are gone (often multiple passes).

4. **Milestone breakdown**  
   Split delivery into small, reviewable milestones. Prefer one milestone at a time for any later agentic implementation.

5. **Evidence pack**  
   Emit research notes, design-doc status, milestone plan, and risk list before claiming the design phase is complete.

## Discipline Checklist (Frontend Team Skills)

When reviewing or designing, explicitly cover:

| Area | Focus |
|------|--------|
| Design systems / UI | Component reuse, tokens, consistency with existing system |
| Accessibility | Keyboard, screen readers, contrast, focus, ARIA, WCAG targets |
| Performance | Core Web Vitals, load path, runtime cost, image/font strategy |
| UX writing / copy | Microcopy, empty states, errors, CTAs, tone, clarity |
| Usability | Task success, cognitive load, edge cases, user research signals |

## Procedure

1. Capture intent, constraints, and any existing design artifacts.
2. Establish repository / design-surface identity (use `repo-map` evidence when available).
3. Perform bounded research of comparable large-system solutions; record sources and key trade-offs.
4. Draft or revise the design document; iterate until major ambiguities are resolved.
5. Produce an ordered milestone plan with acceptance criteria per milestone.
6. Run the discipline checklist above and record risks and open questions.
7. Emit the shared evidence pack. Do not claim implementation complete.

Use [checklist.md](checklist.md). Consult [failure-modes.md](failure-modes.md), [adapter-interface.md](adapter-interface.md), and [examples.md](examples.md). Format results with [evidence-template.md](evidence-template.md).

## Evidence, Recovery, And Dependencies

Emit:
- research summary and sources
- design-document status and remaining ambiguities
- milestone plan
- accessibility / performance / UX-writing / usability findings
- skipped checks and unresolved questions

Recover from missing docs or unclear intent by narrowing scope and asking for clarification; never invent product requirements or mutate the target project.

Depends on the evidence-pack contract and optionally `repo-map`. Adapters may supply design-system paths, brand voice rules, or known accessibility targets; they must not weaken safety boundaries.

## Approval Boundary

Research, design-doc drafting, and milestone planning need no extra approval beyond invoking this skill. Any later code change, dependency change, or deployment requires a separate action-capable skill and explicit approval.

## Completion

Claim `complete` only when:
- research notes with sources exist
- a design document (or explicit decision that one is not yet warranted) is produced
- milestones with acceptance criteria are listed
- the discipline checklist was applied and risks recorded
- no target-project mutation occurred
- the evidence pack is complete

Otherwise report `partial`, `failed`, or `blocked`. Never equate a written plan with shipped frontend work.

These conditions are both the acceptance criteria and definition of done.

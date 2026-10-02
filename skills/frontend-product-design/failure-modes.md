# Failure Modes

## Research skipped or shallow
**Symptom:** Design doc written from intuition only.  
**Response:** Stop. Perform research of comparable systems and record sources before continuing.

## Ambiguous or missing intent
**Symptom:** Goals or success criteria unclear.  
**Response:** Report `blocked` or `partial` and request clarification. Do not invent requirements.

## Design system ignored
**Symptom:** Proposal invents parallel components or tokens.  
**Response:** Map against existing design system; prefer extension over reinvention.

## Accessibility omitted
**Symptom:** No keyboard, screen-reader, contrast, or focus plan.  
**Response:** Add explicit a11y requirements and risks before claiming design complete.

## Performance ignored
**Symptom:** No load, runtime, or Core Web Vitals consideration.  
**Response:** Add performance budget notes and risks.

## Copy / microcopy treated as afterthought
**Symptom:** Empty states, errors, and CTAs unspecified.  
**Response:** List required UX writing surfaces and tone constraints.

## Usability risks unexamined
**Symptom:** Happy path only.  
**Response:** List edge cases, failure states, and cognitive-load concerns.

## Milestone scope too large
**Symptom:** Single milestone covers the entire feature.  
**Response:** Split into smaller reviewable slices with independent acceptance criteria.

## Mutation attempted
**Symptom:** Agent edits source, installs packages, or runs mutating commands under this skill.  
**Response:** Refuse. This skill is guidance/audit-oriented. Use a separate approved action skill.

## False completion
**Symptom:** Claiming the feature is implemented after only a design plan.  
**Response:** Report design-phase complete only. Implementation requires a separate skill and evidence.

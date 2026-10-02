# Adapter Interface

Adapters may supply optional hints that narrow this skill without weakening safety:

- Known design-system package or path
- Brand / voice / tone rules for UX writing
- Accessibility target (e.g. WCAG 2.2 AA)
- Performance budgets or Core Web Vitals targets
- Preferred research sources or internal pattern libraries
- Milestone conventions already used by the product team

Adapters must not:
- permit source mutation, installs, deploys, or secret reads
- hide failed or skipped checks
- redefine completion to mean "code was written"
- replace the research-first requirement

Adapter compatibility follows the shared skill-manifest contract (`contractVersion` 1.0.0).

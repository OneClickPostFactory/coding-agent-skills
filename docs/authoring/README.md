# Authoring

New skills must:

1. Define precise trigger conditions in YAML frontmatter.
2. State whether they are audit-only or action-capable.
3. Define command families, argument constraints, and restricted categories.
4. Use the shared evidence-pack contract.
5. Prevent `complete` when required evidence failed or was skipped without an acceptable consequence.
6. Keep provider and project behavior in explicit adapters.
7. Include tests for trigger behavior, command policy, mutation prevention, privacy, adapters, and false completion.
8. Keep `SKILL.md` concise and link directly to detailed companion references.
9. Use imperative procedures and explicit status transitions.
10. Validate `agents/openai.yaml` whenever trigger wording changes.

Do not copy commands from restricted evidence into procedures. Use placeholders instead of private paths, domains, identifiers, or credentials.

Project adapters may add known paths, script aliases, source precedence, status-only commands, and evidence requirements. They may not weaken restrictions, hide failures, or redefine completion.

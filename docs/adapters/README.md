# Adapter Discovery

Project-specific adapters live in their owning project repositories, not this shared repository.

## Convention

A project may expose adapter metadata under:

```text
.agents/coding-agent-skills/<skill-name>/adapter.json
```

Discovery is opt-in:

1. Start from the confirmed project root.
2. Look only for the exact adapter path for the selected shared skill.
3. Validate adapter identity and declared shared-skill compatibility.
4. Apply adapter rules only after shared restrictions.
5. Record the adapter path and version in the evidence pack.

Adapters may add safe paths, aliases, source precedence, status-only commands, and evidence requirements. They cannot add restricted operations, access secrets, suppress failures, expand beyond declared scope, or redefine completion.

No project adapter is implemented in the pilot release.

# LLM Drift Control Workflow

**Intent:** Verify a project claim against the current branch.

1. Split the claim into atomic statements.
2. Assign expected source types.
3. Read bounded documentation, source, tests, Git, and existing runtime evidence.
4. Classify each claim as confirmed, partial, stale, contradicted, or unverifiable.
5. Record confidence and unresolved conflicts.
6. Suggest corrective work without performing it.

```bash
rg -n "exampleCapability" README.md src test
```

**Unsafe and denied:** rewriting documentation or code, treating prompts as proof, and changing runtime state.

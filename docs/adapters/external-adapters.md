# Validating External Adapters

Run the dependency-free validator from the shared core repository:

```bash
node scripts/validate-adapters.mjs <adapter-root>
```

The argument is the project or fixture root beneath which the declared discovery locations
may exist. The validator reads only core schemas and policies plus discovered `adapter.json`
files. It does not read `.env`, install dependencies, run adapter commands, or change the
target project.

## Results

- Exit `0`: every discovered adapter is accepted, including the explicit zero-adapter case.
- Exit `1`: a root, container, manifest, schema, compatibility, inheritance, or path-safety
  rejection occurred.
- Exit `2`: the command is missing its required root argument.

Output contains counts, public pilot skill IDs for accepted adapters, and stable rejection
codes. It does not echo adapter IDs, commands, paths from manifest values, parse snippets,
or secret-like values.

Common rejection categories include unsupported adapter or skill versions, unsupported
skill IDs, mode override, restriction weakening, unsafe command alias, secret exposure,
failure suppression, completion override, required-evidence removal, scope expansion,
unsafe path, malformed JSON, missing manifest, and symlink escape.

## Fixture Model

Synthetic fixture roots under `tests/fixtures/external-adapters/` exercise all three
locations, valid adapters, isolated invalid adapters, mixed roots, empty roots, malformed
input, traversal, and temporary symlink escapes. Fixtures contain no real project details.

Real project adapters remain deferred. When approved later, they should be owned by their
project repository, declare compatibility with a released shared core, and pass this
validator without changing shared restrictions.

# Project Adapter Interface

Validate adapters against `../../schemas/project-adapter.schema.json` and confirm manifest compatibility before applying them.

An adapter may define authoritative-document precedence, phase markers, generated-document relationships, canonical source directories, test-to-capability mappings, and safe drift-check scripts.

It cannot declare prompts authoritative, suppress contradictions, rewrite sources, run mutating scripts, or redefine the five claim classifications.

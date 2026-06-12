# Project Adapter Interface

An adapter may declare expected base and protected branches, generated-file patterns, required clean paths, allowed task-scope patterns, and repository-specific handoff checks.

It cannot add Git mutation, hide dirty files or conflicts, suppress whitespace failures, or redefine readiness. Shared policy wins.

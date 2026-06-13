# Project Adapter Interface

Validate adapters against `../../schemas/project-adapter.schema.json` and confirm manifest compatibility before applying them.

An adapter may declare service names, status-only manager commands, expected executables, ports, safe unauthenticated health endpoints, bounded non-secret log locations, and state-classification hints.

It cannot permit lifecycle commands, signals, deployments, secret loading, authenticated APIs, or suppression of contradictory evidence.

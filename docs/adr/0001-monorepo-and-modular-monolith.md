# ADR 0001: Monorepo And Modular Monolith

## Status

Accepted

## Context

The project has a web frontend, a Python backend, shared schemas, future model adapters, and multiple areas that will evolve quickly during early development.

## Decision

Use:

- one repository for the full project
- one frontend app in `apps/web`
- one backend app in `apps/api`
- shared project assets in `packages`
- a modular monolith backend instead of multiple backend services at the start

## Why

- Lower operational complexity during early development
- Clear module boundaries without early infrastructure overhead
- Easier refactors while requirements are still moving
- Shared docs and contracts can live near the implementation
- Future service extraction remains possible if boundaries harden later

## Consequences

- The backend must maintain strong internal boundaries to avoid turning into a large shared code bucket.
- Provider integrations must stay isolated behind adapters.
- Real-time event contracts should be explicit from the beginning.

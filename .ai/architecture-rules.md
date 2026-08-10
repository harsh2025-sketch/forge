# Forge Architecture Rules

## Status: FROZEN

The Forge architecture has been finalized and is frozen. No architectural changes are permitted without formal review.

## Core Principles

- Monorepo-based structure
- pnpm + Turborepo for dependency and build management
- TypeScript for all code
- Modular package structure
- Independent SaaS products in apps/

## Bootstrap Constraints

- Do not redesign the architecture
- Do not add speculative features
- Do not introduce forbidden dependencies
- Do not commit secrets

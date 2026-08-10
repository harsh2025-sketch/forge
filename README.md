# Forge - Master SaaS Framework

Forge is the Master SaaS Framework designed to bootstrap and support multiple independent, acquisition-ready SaaS products.

## Architecture

The Forge architecture is **frozen**. All products built on Forge will inherit a consistent, proven foundation.

## Current Phase

**Bootstrap Phase**

This repository contains only the monorepo structure and foundational configuration. The Master Framework implementation and individual SaaS products will be added in controlled phases.

## Repository Structure

```
forge/
├── apps/           # SaaS product applications (added in Phase 2+)
├── packages/       # Shared framework packages
├── tools/          # Developer tooling
├── docs/           # Architecture and decision documentation
└── .ai/            # AI governance and rules
```

## Technology Stack

- **Runtime**: Node.js 22
- **Package Manager**: pnpm
- **Monorepo Tool**: Turborepo
- **Language**: TypeScript
- **Testing**: Vitest
- **E2E Testing**: Playwright
- **Linting**: ESLint
- **Formatting**: Prettier
- **Version Control**: Git + GitHub

## Getting Started

```bash
# Install dependencies
pnpm install

# Run linter
pnpm lint

# Run type checker
pnpm typecheck

# Run tests
pnpm test

# Build
pnpm build

# Development
pnpm dev
```

## Documentation

See [docs/](./docs/) for architecture decisions, development guidelines, and product specifications.

## License

Proprietary - All rights reserved

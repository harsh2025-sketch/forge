# src/features

Feature modules for JWT Scanner: each feature owns its Server Actions
(`actions.ts`), queries (`queries.ts`), and components. Features may import ports
from `@/providers` and `@forge/db`, but never adapters or vendor SDKs. See
docs/ARCHITECTURE.md.

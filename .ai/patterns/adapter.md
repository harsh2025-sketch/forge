# Adapter Implementation Pattern

## Location
`packages/adapters/[provider]/src/`

## Template

```typescript
// adapter.ts — Implements the port interface

import { type AuthPort, type AuthUser } from "@forge/auth";
import { Result } from "@forge/shared";
import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export const clerkAuthAdapter: AuthPort = {
  async getCurrentUser() {
    try {
      // Get current user from Clerk
      // This is called from middleware context
      return { id: "...", email: "..." };
    } catch (error) {
      return null;
    }
  },

  async requireUser() {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return user;
  },

  async getOrganization(orgId: string) {
    try {
      const org = await clerkClient.organizations.getOrganization({
        organizationId: orgId,
      });
      return { id: org.id, name: org.name };
    } catch (error) {
      return null;
    }
  },

  async requireOrganization(orgId: string) {
    const org = await this.getOrganization(orgId);
    if (!org) throw new Error("Organization not found");
    return org;
  },

  // ... other methods
};

// middleware.ts — Implements AuthMiddleware

import { type AuthMiddleware } from "@forge/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const clerkAuthMiddleware: AuthMiddleware = {
  protect: (options?) => {
    return async (request: NextRequest) => {
      // Validate Clerk auth header
      const header = request.headers.get("authorization");
      if (!header && options?.organizationRequired) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.next();
    };
  },
};

// webhook.ts — Implements AuthWebhookHandler

import { type AuthWebhookHandler } from "@forge/auth";

export const clerkAuthWebhookHandler: AuthWebhookHandler = {
  async verifyWebhookSignature(request: Request) {
    // Verify Clerk webhook signature
    // Return payload or throw
  },

  async handleUserCreated(payload: unknown) {
    // Sync to platform.users
  },

  async handleUserUpdated(payload: unknown) {
    // Update platform.users
  },

  // ... other handlers
};

// index.ts

export { clerkAuthAdapter };
export { clerkAuthMiddleware };
export { clerkAuthWebhookHandler };
```

## Key Constraints

- Adapter implements exactly ONE port.
- Adapter imports the port interface only (no other `@forge/` packages except shared).
- Adapter imports the vendor SDK exactly once in this adapter package.
- No business logic in adapter — only translation between port and vendor API.
- Adapters have conformance tests in `packages/testing/conformance/`.

## Conformance Testing

Every adapter must pass its conformance suite:

```typescript
// packages/testing/conformance/auth.ts

import { type AuthPort } from "@forge/auth";

export const authConformanceTests = (adapter: AuthPort) => {
  return [
    {
      name: "getCurrentUser returns null when no user",
      test: async () => {
        const user = await adapter.getCurrentUser();
        if (user !== null) throw new Error("Expected null");
      },
    },
    {
      name: "requireUser throws when no user",
      test: async () => {
        try {
          await adapter.requireUser();
          throw new Error("Should have thrown");
        } catch (error) {
          if (!(error instanceof Error)) throw error;
          if (!error.message.includes("Unauthorized")) throw error;
        }
      },
    },
    // ... more tests
  ];
};
```

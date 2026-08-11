/**
 * Test-only helpers for @forge/adapter-clerk: a fake Clerk backend client
 * (dependency injection — no Clerk account or credentials required), request
 * builders and svix webhook signing.
 */

import { Webhook } from "svix";
import type {
  ClerkBackendClient,
  ClerkOrganizationLike,
  ClerkUserLike,
} from "../src/adapter.js";

/** Mimics the shape of Clerk API errors (carries an HTTP `status`). */
export class FakeClerkApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "FakeClerkApiError";
  }
}

/** Injectable failure for every fake client call. */
export interface FakeClerkFailure {
  readonly status?: number;
  readonly message?: string;
}

/** Seeded state for the fake Clerk client. */
export interface FakeClerkState {
  readonly users?: ReadonlyMap<string, ClerkUserLike>;
  readonly organizations?: ReadonlyMap<string, ClerkOrganizationLike>;
  readonly memberships?: ReadonlyMap<string, readonly ClerkOrganizationLike[]>;
  /** When set, every call throws this failure instead. */
  failWith?: FakeClerkFailure;
}

/** Creates a structural fake of the Clerk backend client for unit tests. */
export function createFakeClerkClient(state: FakeClerkState): ClerkBackendClient {
  const users = state.users ?? new Map();
  const organizations = state.organizations ?? new Map();
  const memberships = state.memberships ?? new Map();

  function maybeFail(): void {
    if (state.failWith !== undefined) {
      throw new FakeClerkApiError(state.failWith.status ?? 500, state.failWith.message ?? "Clerk failure");
    }
  }

  return {
    users: {
      async getUser(userId) {
        maybeFail();
        const user = users.get(userId);
        if (user === undefined) {
          throw new FakeClerkApiError(404, `User ${userId} not found`);
        }
        return user;
      },
      async getOrganizationMembershipList({ userId }) {
        maybeFail();
        const data = (memberships.get(userId) ?? []).map((organization) => ({ organization }));
        return { data };
      },
    },
    organizations: {
      async getOrganization({ organizationId }) {
        maybeFail();
        const organization = organizations.get(organizationId);
        if (organization === undefined) {
          throw new FakeClerkApiError(404, `Organization ${organizationId} not found`);
        }
        return organization;
      },
    },
  };
}

/** Builds a structural middleware/webhook header reader. */
export function makeHeaders(headers: Readonly<Record<string, string>>): {
  get(name: string): string | null;
} {
  return {
    get(name: string): string | null {
      const match = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
      return match === undefined ? null : headers[match];
    },
  };
}

/** Builds a structural middleware request. */
export function makeMiddlewareRequest(
  headers: Readonly<Record<string, string>>,
  url = "https://app.example.test/protected"
): { url: string; headers: { get(name: string): string | null } } {
  return { url, headers: makeHeaders(headers) };
}

/** Builds a structural webhook request. */
export function makeWebhookRequest(
  headers: Readonly<Record<string, string>>,
  body: string
): { headers: { get(name: string): string | null }; text(): Promise<string> } {
  return { headers: makeHeaders(headers), text: async () => body };
}

/** Signs `payload` with the svix scheme Clerk uses for webhooks. */
export function signClerkWebhook(
  secret: string,
  payload: unknown,
  options?: { id?: string; timestamp?: Date; secretOverride?: string }
): { headers: Record<string, string>; body: string } {
  const id = options?.id ?? "msg_test_0001";
  const timestamp = options?.timestamp ?? new Date();
  const body = JSON.stringify(payload);
  const signature = new Webhook(options?.secretOverride ?? secret).sign(id, timestamp, body);
  return {
    headers: {
      "svix-id": id,
      "svix-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "svix-signature": signature,
    },
    body,
  };
}

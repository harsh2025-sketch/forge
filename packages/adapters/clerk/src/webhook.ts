/**
 * Clerk → AuthWebhookHandler adapter.
 * V3 §3.2 (packages/adapters/clerk), §5.2 (AuthWebhookHandler contract), Day 5.
 *
 * Signature verification uses Clerk's webhook verification mechanism (svix
 * `svix-id`/`svix-timestamp`/`svix-signature` headers with the Clerk webhook
 * signing secret). Verified payloads are validated, translated into
 * provider-neutral shapes and handed to injected event callbacks — the seam
 * product wiring uses to sync identity data. No database access happens in
 * this package.
 */

import { Webhook } from "svix";
import { AuthErrorCode, AuthPortError } from "@forge/auth";
import type { AuthOrganization, AuthUser, AuthWebhookHandler } from "@forge/auth";

/** Normalized payload handed to user event callbacks. */
export interface ClerkUserEvent {
  readonly user: AuthUser;
}

/** Normalized payload handed to organization event callbacks. */
export interface ClerkOrganizationEvent {
  readonly organization: AuthOrganization;
}

/** Options for `clerkAuthWebhookHandler`. */
export interface CreateClerkAuthWebhookHandlerOptions {
  /** The Clerk webhook signing secret (`whsec_...`). */
  readonly webhookSecret: string;
  /** Invoked after a verified, validated `user.created` event. */
  readonly onUserCreated?: (event: ClerkUserEvent) => void | Promise<void>;
  /** Invoked after a verified, validated `user.updated` event. */
  readonly onUserUpdated?: (event: ClerkUserEvent) => void | Promise<void>;
  /** Invoked after a verified, validated `organization.created` event. */
  readonly onOrganizationCreated?: (event: ClerkOrganizationEvent) => void | Promise<void>;
}

function parseClerkEvent(payload: unknown, expectedType: string): Record<string, unknown> {
  if (typeof payload !== "object" || payload === null) {
    throw new AuthPortError(`Expected a Clerk ${expectedType} event payload`, {
      code: AuthErrorCode.PROVIDER_FAILURE,
    });
  }
  const event = payload as Record<string, unknown>;
  if (event.type !== expectedType) {
    throw new AuthPortError(
      `Unexpected Clerk event type: expected ${expectedType}, received ${String(event.type)}`,
      { code: AuthErrorCode.PROVIDER_FAILURE }
    );
  }
  if (typeof event.data !== "object" || event.data === null) {
    throw new AuthPortError(`Malformed Clerk ${expectedType} event data`, {
      code: AuthErrorCode.PROVIDER_FAILURE,
    });
  }
  return event.data as Record<string, unknown>;
}

/**
 * Extracts the primary email from a Clerk user event payload: the primary
 * email address when identifiable, otherwise the first listed address, then a
 * top-level `email_address` field.
 */
function extractClerkEmail(data: Record<string, unknown>): string | null {
  const listed = Array.isArray(data.email_addresses) ? data.email_addresses : [];
  const entries = listed.filter(
    (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null
  );
  const primaryId =
    typeof data.primary_email_address_id === "string" ? data.primary_email_address_id : null;
  const primary =
    (primaryId !== null ? entries.find((entry) => entry.id === primaryId) : undefined) ??
    entries[0];
  const listedAddress =
    primary !== undefined && typeof primary.email_address === "string"
      ? primary.email_address
      : "";
  if (listedAddress !== "") {
    return listedAddress;
  }
  return typeof data.email_address === "string" && data.email_address !== ""
    ? data.email_address
    : null;
}

function userFromClerkData(data: Record<string, unknown>, eventType: string): AuthUser {
  const id = data.id;
  if (typeof id !== "string" || id === "") {
    throw new AuthPortError(`Invalid Clerk ${eventType} payload: missing user id`, {
      code: AuthErrorCode.PROVIDER_FAILURE,
    });
  }
  const email = extractClerkEmail(data);
  if (email === null) {
    throw new AuthPortError(`Invalid Clerk ${eventType} payload: user has no email address`, {
      code: AuthErrorCode.PROVIDER_FAILURE,
      details: { userId: id },
    });
  }
  const nameParts = [data.first_name, data.last_name].filter(
    (part): part is string => typeof part === "string" && part !== ""
  );
  return { id, email, name: nameParts.length > 0 ? nameParts.join(" ") : undefined };
}

function organizationFromClerkData(data: Record<string, unknown>, eventType: string): AuthOrganization {
  const id = data.id;
  const name = data.name;
  if (typeof id !== "string" || id === "") {
    throw new AuthPortError(`Invalid Clerk ${eventType} payload: missing organization id`, {
      code: AuthErrorCode.PROVIDER_FAILURE,
    });
  }
  if (typeof name !== "string" || name === "") {
    throw new AuthPortError(`Invalid Clerk ${eventType} payload: missing organization name`, {
      code: AuthErrorCode.PROVIDER_FAILURE,
      details: { organizationId: id },
    });
  }
  return {
    id,
    name,
    slug: typeof data.slug === "string" && data.slug !== "" ? data.slug : undefined,
  };
}

/**
 * Builds the AuthWebhookHandler implementation backed by Clerk webhook
 * verification. Invalid signatures map to `AUTH_INVALID_WEBHOOK_SIGNATURE`;
 * malformed provider payloads map to `AUTH_PROVIDER_FAILURE` — the existing
 * @forge/auth error contract, nothing else.
 */
export function clerkAuthWebhookHandler(
  options: CreateClerkAuthWebhookHandlerOptions
): AuthWebhookHandler {
  const webhook = new Webhook(options.webhookSecret);

  async function verifyWebhookSignature(request: {
    headers: { get(name: string): string | null };
    text(): Promise<string>;
  }): Promise<unknown> {
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");
    if (svixId === null || svixTimestamp === null || svixSignature === null) {
      throw new AuthPortError("Missing Clerk webhook signature headers", {
        code: AuthErrorCode.INVALID_WEBHOOK_SIGNATURE,
      });
    }
    const body = await request.text();
    try {
      return webhook.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch (error) {
      throw new AuthPortError("Invalid Clerk webhook signature", {
        code: AuthErrorCode.INVALID_WEBHOOK_SIGNATURE,
        cause: error,
      });
    }
  }

  async function handleUserCreated(payload: unknown): Promise<void> {
    const data = parseClerkEvent(payload, "user.created");
    const user = userFromClerkData(data, "user.created");
    await options.onUserCreated?.({ user });
  }

  async function handleUserUpdated(payload: unknown): Promise<void> {
    const data = parseClerkEvent(payload, "user.updated");
    const user = userFromClerkData(data, "user.updated");
    await options.onUserUpdated?.({ user });
  }

  async function handleOrganizationCreated(payload: unknown): Promise<void> {
    const data = parseClerkEvent(payload, "organization.created");
    const organization = organizationFromClerkData(data, "organization.created");
    await options.onOrganizationCreated?.({ organization });
  }

  return { verifyWebhookSignature, handleUserCreated, handleUserUpdated, handleOrganizationCreated };
}

/**
 * Billing webhook endpoint (V3 §3.3, §5.2).
 *
 * The only place in the application that consumes raw provider payloads.
 * Signature verification and payload validation are delegated to the wired
 * BillingWebhookHandler (Stripe adapter in live mode, mock handler in test
 * mode); the route then projects the verified event onto the product's
 * neutral platform.subscriptions row.
 *
 * Provider payload field extraction happens only here, at the webhook
 * boundary — never in domain or feature business logic.
 */

import { getBillingWebhookHandler, getSubscriptionPersistence } from "@/providers";
import { SubscriptionStatusValue } from "@/features/billing/subscription-persistence";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Extracts the neutral subscription projection from a verified
 * checkout-completed payload. Provider payload shapes differ (Stripe nests
 * the session under data.object; the mock seam uses top-level fields); only
 * the fields the product needs are read, defensively.
 */
function checkoutProjection(payload: unknown): {
  readonly customerId: string;
  readonly subscriptionId: string | null;
} | null {
  const event = asRecord(payload);
  if (event === null) return null;

  const data = asRecord(event.data);
  const object = data === null ? null : asRecord(data.object);

  const read = (source: Record<string, unknown> | null, key: string): string | null => {
    if (source === null) return null;
    const value = source[key];
    return typeof value === "string" ? value : optionalString(asRecord(value)?.id);
  };

  const customerId = read(object, "customer") ?? read(event, "customerId");
  const subscriptionId =
    read(object, "subscription") ?? read(event, "subscriptionId");
  if (customerId === null) return null;
  return { customerId, subscriptionId };
}

export async function POST(request: Request): Promise<Response> {
  let handler;
  try {
    handler = getBillingWebhookHandler();
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Webhook not configured" },
      { status: 500 },
    );
  }

  let payload: unknown;
  try {
    payload = await handler.verifyWebhookSignature(request);
  } catch {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const event = asRecord(payload);
  const eventType = typeof event?.type === "string" ? event.type : "";

  try {
    if (eventType.includes("checkout")) {
      await handler.handleCheckoutCompleted(payload);
      const projection = checkoutProjection(payload);
      if (projection !== null) {
        // Find the org's subscription row by the provider customer id and
        // flip it to active. This is a projection of provider state; the
        // provider remains the source of truth.
        const persistence = getSubscriptionPersistence();
        const rows = await persistence.rowsByCustomer(projection.customerId);
        for (const row of rows) {
          await persistence.upsert(row.organizationId, {
            status: SubscriptionStatusValue.ACTIVE,
            externalSubscriptionId: projection.subscriptionId,
          });
        }
      }
      return Response.json({ ok: true });
    }
    if (eventType.includes("subscription") && eventType.includes("deleted")) {
      await handler.handleSubscriptionDeleted(payload);
      return Response.json({ ok: true });
    }
    if (eventType.includes("subscription") && eventType.includes("updated")) {
      await handler.handleSubscriptionUpdated(payload);
      return Response.json({ ok: true });
    }
    if (eventType.includes("invoice") && eventType.includes("payment_failed")) {
      await handler.handleInvoicePaymentFailed(payload);
      return Response.json({ ok: true });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}

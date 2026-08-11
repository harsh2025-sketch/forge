/**
 * Health check endpoint (V3 §13.2 launch gate — "Expose a health check
 * endpoint"; see docs/DEPLOYMENT.md and docs/OPERATIONS.md).
 *
 * Returns the application status without touching the database or any
 * provider, so orchestrators and load balancers can probe liveness even when
 * downstream services are unavailable. Secrets are never included.
 */

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(
    {
      status: "ok",
      service: "jwt-scanner",
      time: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

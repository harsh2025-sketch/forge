/**
 * E2E critical path (V3 §20.2 Day 13):
 *
 *   SIGNUP → SCAN → VIEW FINDINGS → EXPORT
 *
 * The application runs in deterministic test mode (AUTH_MODE=test,
 * DATA_MODE=memory): the "signup" step is the auth-port seam resolving a
 * fixed authenticated principal with one organization, exactly as the task
 * permits when live Clerk credentials are unavailable. Live-signup
 * verification requires real Clerk credentials and is documented in
 * docs/TESTING.md.
 */

import { expect, test } from "@playwright/test";

/** A compact JWT that triggers the none_alg finding (alg=none). */
const UNSECURED_TOKEN = [
  Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }), "utf8").toString("base64url"),
  Buffer.from(
    JSON.stringify({ sub: "1234567890", name: "John Doe", admin: true, exp: 4_102_444_800 }),
    "utf8",
  ).toString("base64url"),
  "", // empty signature — alg=none
].join(".");

test("signup → scan JWT → view findings → export report", async ({ page }) => {
  // ── SIGNUP (deterministic auth seam) ────────────────────────────────
  // Start at the landing page and follow the primary CTA; the test-mode
  // auth seam signs the user in with a fixed principal + organization.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /catch algorithm confusion/ })).toBeVisible();
  await page.getByRole("link", { name: "Start scanning" }).first().click();

  // Authenticated: the scanner page is now reachable.
  await expect(page.getByRole("heading", { name: "Scan a JWT" })).toBeVisible();

  // ── SCAN ────────────────────────────────────────────────────────────
  await page.getByLabel("JWT token to scan").fill(UNSECURED_TOKEN);
  await page.getByRole("button", { name: "Run scan" }).click();

  // ── VIEW FINDINGS ───────────────────────────────────────────────────
  await expect(page.getByRole("heading", { name: "Scan results" })).toBeVisible();
  await expect(page.getByText("Unsecured JWT algorithm declared")).toBeVisible();
  await expect(page.getByText("critical", { exact: true }).first()).toBeVisible();

  // Open the finding detail view.
  await page.getByRole("link", { name: "Unsecured JWT algorithm declared" }).click();
  await expect(page.getByRole("heading", { name: "Finding" })).toBeVisible();
  await expect(page.getByText("Recommendation")).toBeVisible();
  await expect(page.getByText("Evidence")).toBeVisible();
  await expect(page.getByText("Signature segment present:")).toBeVisible();

  // ── EXPORT ──────────────────────────────────────────────────────────
  // Back to results, then download the JSON report.
  await page.getByRole("link", { name: "← Back to scan results" }).click();
  await expect(page.getByRole("heading", { name: "Scan results" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-json").click();
  const download = await downloadPromise;

  const suggestedFilename = download.suggestedFilename();
  expect(suggestedFilename).toMatch(/^jwt-scanner-.+\.json$/);

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const report = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    summary: { totalFindings: number; findingsBySeverity: Record<string, number> };
    findings: Array<{ severity: string; category: string; title: string }>;
  };

  expect(report.summary.totalFindings).toBeGreaterThan(0);
  expect(report.findings[0]!.category).toBe("none_alg");
  expect(report.findings[0]!.severity).toBe("critical");
  expect(report.findings[0]!.title).toContain("Unsecured JWT algorithm declared");
});

test("landing page renders product identity, pricing and the primary CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /catch algorithm confusion/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What the scanner checks" })).toBeVisible();
  await expect(page.getByText("JWT algorithm-confusion & none-alg detection")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start scanning" }).first()).toHaveAttribute(
    "href",
    "/scanner",
  );
  await expect(page.getByText("Free")).toBeVisible();
  await expect(page.getByText("Pro")).toBeVisible();
});

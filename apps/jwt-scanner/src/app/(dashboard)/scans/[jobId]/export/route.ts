/**
 * Report export route (V3 §20.2 Day 13 — report export).
 *
 * GET /scans/[jobId]/export?format=json|markdown|html
 *
 * Authenticates and org-scopes the request, renders the report through
 * @forge/reporting (see src/features/scans/report.ts), records the export row
 * in jwt_scanner.reports, and streams the result as a downloadable
 * attachment. Expected failures return structured error responses; nothing
 * here depends on a vendor SDK.
 */

import { authPort, getScanPersistence } from "@/providers";
import { getOrgUserContext } from "@/features/auth/session";
import { ensurePlatformOrganization } from "@/features/auth/identity";
import { ProductEngine } from "@/domain/engine";
import { exportScanReport } from "@/features/scans/service";
import { EXPORT_FORMATS, isExportFormat } from "@/features/scans/report";

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<(typeof EXPORT_FORMATS)[number], string> = {
  json: "application/json; charset=utf-8",
  markdown: "text/markdown; charset=utf-8",
  html: "text/html; charset=utf-8",
};

export async function GET(
  request: Request,
  { params }: { readonly params: Promise<{ readonly jobId: string }> },
): Promise<Response> {
  const url = new URL(request.url);
  const rawFormat = url.searchParams.get("format") ?? "json";
  if (!isExportFormat(rawFormat)) {
    return Response.json(
      { error: `Unsupported report format: ${rawFormat}` },
      { status: 400 },
    );
  }
  const { jobId } = await params;

  const context = await getOrgUserContext(authPort, ensurePlatformOrganization);
  if (!context.ok) {
    return Response.json({ error: context.error }, { status: 401 });
  }

  const exported = await exportScanReport(
    {
      auth: authPort,
      persistence: getScanPersistence(),
      engine: new ProductEngine(),
    },
    jobId,
    rawFormat,
  );
  if (!exported.ok) {
    const status = exported.error === "Scan not found" ? 404 : 500;
    return Response.json({ error: exported.error }, { status });
  }

  const { content, filename } = exported.value;
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPES[rawFormat],
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

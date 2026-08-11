/**
 * Scan results page (V3 §20.2 Day 13 — results display).
 * Loads org-scoped results through the feature service and renders them with
 * the results view. Missing scans map to 404; failures render an error state.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@forge/ui";
import { authPort, getScanPersistence } from "@/providers";
import { getOrgUserContext } from "@/features/auth/session";
import { ensurePlatformOrganization } from "@/features/auth/identity";
import { ProductEngine } from "@/domain/engine";
import { getScanResults } from "@/features/scans/service";
import { ScanResultsView } from "@/components/scan/scan-results";
import { ReportExportLinks } from "@/components/scan/report-export-links";
import type { FindingRow } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function ScanResultsPage({
  params,
}: {
  readonly params: { readonly jobId: string };
}) {
  const context = await getOrgUserContext(authPort, ensurePlatformOrganization);
  if (!context.ok) {
    return (
      <EmptyState title="Not available" description={context.error} />
    );
  }

  const results = await getScanResults(
    {
      auth: authPort,
      persistence: getScanPersistence(),
      engine: new ProductEngine(),
    },
    params.jobId,
  );

  if (!results.ok) {
    if (results.error === "Scan not found") {
      notFound();
    }
    return <EmptyState title="Could not load results" description={results.error} />;
  }
  const scanResults = results.value;

  function findingLink(finding: FindingRow) {
    return (
      <Link href={`/scans/${scanResults.job.id}/findings/${finding.id}`} style={{ color: "var(--forge-colors-brand-primary)" }}>
        {finding.title}
      </Link>
    );
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Scan results</h1>
      <ScanResultsView results={scanResults} renderFindingLink={findingLink} />
      <ReportExportLinks jobId={scanResults.job.id} />
    </div>
  );
}

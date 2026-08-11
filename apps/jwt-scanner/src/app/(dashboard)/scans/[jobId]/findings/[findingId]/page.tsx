/**
 * Finding detail page (V3 §20.2 Day 13 — finding detail).
 * Org-scoped load of one persisted finding; missing findings map to 404.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@forge/ui";
import { authPort, getScanPersistence } from "@/providers";
import { getOrgUserContext } from "@/features/auth/session";
import { ensurePlatformOrganization } from "@/features/auth/identity";
import { ProductEngine } from "@/domain/engine";
import { getFindingDetail } from "@/features/scans/service";
import { FindingDetailView } from "@/components/scan/finding-detail-view";

export const dynamic = "force-dynamic";

export default async function FindingDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly jobId: string; readonly findingId: string }>;
}) {
  const context = await getOrgUserContext(authPort, ensurePlatformOrganization);
  if (!context.ok) {
    return <EmptyState title="Not available" description={context.error} />;
  }
  const { jobId, findingId } = await params;

  const detail = await getFindingDetail(
    {
      auth: authPort,
      persistence: getScanPersistence(),
      engine: new ProductEngine(),
    },
    jobId,
    findingId,
  );

  if (!detail.ok) {
    if (detail.error === "Finding not found" || detail.error === "Scan not found") {
      notFound();
    }
    return <EmptyState title="Could not load finding" description={detail.error} />;
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Finding</h1>
      <FindingDetailView
        finding={detail.value.finding}
        jobId={jobId}
        renderBackLink={(jobId) => (
          <Link href={`/scans/${jobId}`} style={{ color: "var(--forge-colors-brand-primary)" }}>
            ← Back to scan results
          </Link>
        )}
      />
    </div>
  );
}

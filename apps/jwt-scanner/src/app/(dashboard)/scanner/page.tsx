/**
 * Scanner page (V3 §20.2 Day 13 — scan submission): the scan form plus the
 * organization's recent scans. Protected by the dashboard layout's auth
 * guard.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, EmptyState, Table } from "@forge/ui";
import { authPort, getScanPersistence } from "@/providers";
import { getOrgUserContext } from "@/features/auth/session";
import { ensurePlatformOrganization } from "@/features/auth/identity";
import { ProductEngine } from "@/domain/engine";
import { listRecentScans } from "@/features/scans/service";
import { submitScanAction } from "@/features/scans/actions";
import { ScanForm } from "@/components/scan/scan-form";

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const context = await getOrgUserContext(authPort, ensurePlatformOrganization);
  if (!context.ok) {
    redirect("/?auth=required");
  }

  const recent = await listRecentScans(
    {
      auth: authPort,
      persistence: getScanPersistence(),
      engine: new ProductEngine(),
    },
    10,
  );

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Scan a JWT</h1>
      <ScanForm submitAction={submitScanAction} />

      <div style={{ marginTop: "calc(var(--forge-spacing-unit) * 6)" }}>
        <h2>Recent scans</h2>
        {!recent.ok || recent.value.length === 0 ? (
          <EmptyState
            title="No scans yet"
            description="Submit a JWT above to run your first scan."
          />
        ) : (
          <Card>
            <Table<{ id: string; status: string; createdAt: string }>
              caption="Recent scans (newest first)"
              variant="striped"
              columns={[
                {
                  key: "id",
                  header: "Scan",
                  render: (row) => (
                    <Link href={`/scans/${row.id}`} style={{ color: "var(--forge-colors-brand-primary)" }}>
                      {row.id}
                    </Link>
                  ),
                },
                { key: "status", header: "Status" },
                { key: "createdAt", header: "Submitted" },
              ]}
              rows={recent.value.map((job) => ({
                id: job.id,
                status: job.status,
                createdAt: job.createdAt.toISOString(),
              }))}
            />
          </Card>
        )}
      </div>
    </div>
  );
}

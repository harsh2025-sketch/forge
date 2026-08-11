/**
 * Dashboard layout (V3 §20.2 Day 13 — authentication).
 *
 * Protected application shell: unauthenticated users are redirected to the
 * landing page with an `auth=required` hint; authenticated users get the
 * org-scoped Shell (Sidebar navigation from the product theme). The
 * organization context is resolved through the AuthPort (never a vendor SDK)
 * and the platform organization row is synced so tenant-scoped foreign keys
 * are valid.
 */

import { redirect } from "next/navigation";
import { Shell, TopNav } from "@forge/ui";
import { authPort } from "@/providers";
import { getOrgUserContext } from "@/features/auth/session";
import { ensurePlatformOrganization } from "@/features/auth/identity";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const context = await getOrgUserContext(authPort, ensurePlatformOrganization);
  if (!context.ok) {
    redirect("/?auth=required");
  }
  const { org } = context.value;

  return (
    <Shell
      topNav={
        <TopNav
          brand={<span style={{ fontWeight: "var(--forge-typography-heading-weight)" }}>JWT Scanner</span>}
          actions={
            <span style={{ color: "var(--forge-colors-surface-muted-foreground)" }}>
              {org.name}
            </span>
          }
        />
      }
      sidebar={<DashboardNav activePath="/" orgName={org.name} />}
    >
      {children}
    </Shell>
  );
}

/**
 * JWT Scanner scan feature — server actions (V3 §3.3, .ai/patterns/server-action).
 *
 * Thin Next.js boundary over the feature service. All validation,
 * authorization, business logic and persistence live in service.ts; the
 * actions only wire the composition root (src/providers.ts) and return
 * `Result` values that client components can render. Expected failures never
 * throw.
 */

"use server";

import type { Result } from "@forge/shared";
import { authPort, getScanPersistence } from "@/providers";
import { ProductEngine } from "@/domain/engine";
import {
  getFindingDetail,
  getScanResults,
  listRecentScans,
  submitScan,
  type FindingDetail,
  type ScanResults,
} from "./service.js";
import type { AnalysisJobRow } from "@/db/schema";

function scanDeps() {
  return {
    auth: authPort,
    persistence: getScanPersistence(),
    engine: new ProductEngine(),
  };
}

/** Submits a JWT for analysis. Returns the new job id on success. */
export async function submitScanAction(
  raw: unknown,
): Promise<Result<{ jobId: string; findings: number }, string>> {
  return submitScan(scanDeps(), raw);
}

/** Loads org-scoped results for one scan. */
export async function getScanResultsAction(
  jobId: string,
): Promise<Result<ScanResults, string>> {
  return getScanResults(scanDeps(), jobId);
}

/** Loads one org-scoped finding. */
export async function getFindingDetailAction(
  jobId: string,
  findingId: string,
): Promise<Result<FindingDetail, string>> {
  return getFindingDetail(scanDeps(), jobId, findingId);
}

/** Lists the org's recent scans. */
export async function listRecentScansAction(
  limit?: number,
): Promise<Result<readonly AnalysisJobRow[], string>> {
  return listRecentScans(scanDeps(), limit);
}

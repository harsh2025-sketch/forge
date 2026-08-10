# Job Processor Pattern

## Location
`apps/[product]/src/worker/processors/[job-name].ts`

## Template

```typescript
import { type JobProcessor } from "@forge/jobs";
import { Result } from "@forge/shared";
import { db } from "@/db";
import * as schema from "@/db/schema";
import * as domain from "@/domain";

export interface AnalysisJobData {
  analysisJobId: string;
  organizationId: string;
  projectId: string;
  config: domain.AnalysisConfig;
}

async function validateJobData(
  raw: unknown
): Promise<Result<AnalysisJobData, string>> {
  try {
    const parsed = domain.schemas.validateAnalysisJobData(raw);
    return { ok: true, value: parsed };
  } catch (error) {
    return { ok: false, error: "Invalid job data" };
  }
}

async function fetchJobProgress(jobId: string): Promise<number> {
  const job = await db.query.jobs.findFirst({
    where: (j) => eq(j.id, jobId),
  });
  return job?.progress ?? 0;
}

async function updateJobProgress(jobId: string, percent: number) {
  await db
    .update(schema.jobs)
    .set({ progress: percent })
    .where(eq(schema.jobs.id, jobId));
}

export const analysisJobProcessor: JobProcessor<AnalysisJobData> = {
  async process(data: AnalysisJobData, jobId: string) {
    try {
      // 1. Validate job data
      const validated = await validateJobData(data);
      if (!validated.ok) {
        await updateJobProgress(jobId, -1); // Mark as failed
        throw new Error(validated.error);
      }

      // 2. Load context
      const input = validated.value;

      // 3. Execute engine
      const result = await domain.analyzeProject(input, async (percent) => {
        await updateJobProgress(jobId, percent);
      });

      if (!result.ok) {
        await updateJobProgress(jobId, -1);
        throw new Error(result.error);
      }

      // 4. Persist results
      const { findings, summary, metadata } = result.value;
      await db.insert(schema.findings).values(
        findings.map((f) => ({
          analysis_job_id: input.analysisJobId,
          category: f.category,
          severity: f.severity,
          evidence: f.evidence,
        }))
      );

      await db
        .update(schema.analysis_jobs)
        .set({
          status: "completed",
          findings_count: findings.length,
          summary: summary,
          completed_at: new Date(),
        })
        .where(eq(schema.analysis_jobs.id, input.analysisJobId));

      await updateJobProgress(jobId, 100);
    } catch (error) {
      // Job queue handles retries; we just log
      console.error("Job failed", error);
      await updateJobProgress(jobId, -1);
      throw error;
    }
  },
};
```

## Worker Process Registration

`apps/[product]/src/worker/index.ts`

```typescript
import { jobQueuePort } from "@/providers";
import { analysisJobProcessor } from "./processors/analysis";
import { remediationJobProcessor } from "./processors/remediation";

async function registerProcessors() {
  jobQueuePort.registerProcessor("analysis", analysisJobProcessor);
  jobQueuePort.registerProcessor("remediation", remediationJobProcessor);
}

async function start() {
  await registerProcessors();
  await jobQueuePort.start();
  console.log("Worker started");
}

start().catch((error) => {
  console.error("Worker startup failed", error);
  process.exit(1);
});
```

## Key Constraints

- Processor receives validated data and jobId.
- Processor updates progress via jobQueuePort.
- Processor persists results to database.
- Processor never catches/swallows errors (queue handles retries).
- Processor should be idempotent (safe to retry).
- Long operations should check for cancellation signals.

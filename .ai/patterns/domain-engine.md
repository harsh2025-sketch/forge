# Domain Engine Pattern

## Location
`apps/[product]/src/domain/engine.ts`

## Archetype Contracts

Choose the implementation based on primary archetype.

### Analyzer Engine

```typescript
import { Result } from "@forge/shared";
import * as domain from "@/domain";

export interface AnalysisInput {
  projectId: string;
  config: domain.AnalysisConfig;
}

export interface AnalysisFinding extends domain.BaseFinding {
  category: string;
  evidence: unknown;
}

export interface AnalysisResult {
  findings: AnalysisFinding[];
  summary: domain.ReportSummary;
  metadata: Record<string, unknown>;
}

export async function analyzeProject(
  input: AnalysisInput,
  onProgress: (percent: number) => void
): Promise<Result<AnalysisResult, string>> {
  try {
    // 1. Validate input
    const validated = domain.schemas.validateAnalysisInput(input);
    if (!validated.ok) return { ok: false, error: "Invalid input" };

    // 2. Initialize engine state
    let findingsCount = 0;
    let totalSteps = 100;

    // 3. Execute analysis (update progress)
    onProgress(0);
    const phase1Result = await phase1Scan(input);
    if (!phase1Result.ok) return phase1Result;
    onProgress(30);

    const phase2Result = await phase2Analyze(input, phase1Result.value);
    if (!phase2Result.ok) return phase2Result;
    findingsCount = phase2Result.value.length;
    onProgress(80);

    // 4. Aggregate and summarize
    const summary = createSummary(findingsCount, phase2Result.value);
    onProgress(100);

    return {
      ok: true,
      value: {
        findings: phase2Result.value,
        summary,
        metadata: { engine: "analyzer-v1" },
      },
    };
  } catch (error) {
    return { ok: false, error: "Analysis failed" };
  }
}
```

### Optimizer Engine

```typescript
export interface OptimizationResult {
  metrics: domain.Metric[];
  recommendations: domain.Recommendation[];
  estimatedSavings: { time: string; cost: string };
  remediations?: unknown[];
}

export async function optimize(
  input: OptimizationInput,
  onProgress: (percent: number) => void
): Promise<Result<OptimizationResult, string>> {
  // Similar pattern: validate → execute phases → summarize
  // Return metrics + recommendations + optional remediations
}
```

### Generator Engine

```typescript
export interface GenerationResult {
  artifact: unknown;
  validationResult?: unknown;
  diagnostics?: domain.Diagnostic[];
}

export async function generate(
  input: GenerationInput
): Promise<Result<GenerationResult, string>> {
  // Validate input → generate → optionally validate output
}
```

## Key Constraints

- Engine is PURE DOMAIN LOGIC. No Next.js, no Drizzle, no adapters.
- Engine takes validated input (Zod schema) and returns Result.
- Engine may accept onProgress callback for async operations.
- All infrastructure (queries, external calls) lives in `features/` or middleware.
- Engine has zero side effects (exception: logging).

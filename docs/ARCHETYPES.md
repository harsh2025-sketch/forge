# Forge Archetypes — Product Types and Contracts

## Overview

Every Forge product is built from one of **6 archetypes**. The archetype determines:
- Which engine contract `src/domain/engine.ts` implements
- What input validation looks like
- What output types are produced
- What optional capabilities can be composed

---

## 1. Analyzer

**Purpose:** Accepts structured input, executes analysis, produces findings.

**Engine Contract**

```typescript
export async function execute(
  input: AnalysisInput,
  config: AnalysisConfig,
  onProgress: (percent: number) => void
): Promise<Result<AnalysisResult, string>>
```

**Input**
- Structured definition of what to analyze
- Configuration options
- Optional: file upload or URL to scan

**Output**
```typescript
{
  findings: FindingType[],         // 0+ issues detected
  summary: ReportSummary,          // High-level metrics
  artifacts?: unknown,             // Optional supporting data
  metadata: Record<string, unknown> // Engine version, runtime, etc.
}
```

**Key Characteristics**
- Identifies issues, vulnerabilities, inefficiencies, or violations
- Produces zero or more findings
- Can report on code, config, infrastructure, or behavior
- Findings can have severity levels, evidence, remediation hints

**Examples**
- JWT Scanner → scans tokens for expiration, claims
- Next.js Action Security Auditor → scans Server Actions for vulnerabilities
- PostgreSQL Bloat Analyzer → identifies unused indexes, dead tuples
- K8s RBAC Analyzer → checks Kubernetes role assignments

**Required Capabilities**
- (none by default)

**Optional Capabilities**
- `reporting` — Generate report documents from findings
- `scheduling` — Run analysis on a schedule (nightly scans)
- `remediation` — Suggest or implement fixes

---

## 2. Optimizer

**Purpose:** Analyzes for inefficiency, produces metrics and recommendations.

**Engine Contract**

```typescript
export async function execute(
  input: OptimizationInput,
  config: OptimizationConfig,
  onProgress: (percent: number) => void
): Promise<Result<OptimizationResult, string>>
```

**Output**
```typescript
{
  metrics: MetricType[],            // Measurable statistics
  recommendations: RecommendationType[], // Suggested improvements
  estimatedSavings: {
    time?: string,                  // e.g., "30 seconds per query"
    cost?: string,                  // e.g., "$500/month"
  },
  remediations?: RemediationType[], // Optional: automated fixes
  summary: ReportSummary
}
```

**Key Characteristics**
- Measures current state (metrics)
- Proposes improvements (recommendations)
- Optionally produces executable remediations
- Quantifies impact in time or cost
- Often follows an analyzer pass

**Examples**
- pgvector HNSW Optimizer → suggests index strategies, predicts performance
- PostgreSQL EXPLAIN Repair → analyzes query plans, recommends rewrites
- K8s Right-Sizing → measures resource usage, recommends CPU/memory changes

**Required Capabilities**
- (none by default)

**Optional Capabilities**
- `reporting` — Document metrics and recommendations
- `remediation` — Produce SQL/config to implement recommendations

---

## 3. Generator

**Purpose:** Produces a new artifact from a description or input source.

**Engine Contract**

```typescript
export async function generate(
  input: GenerationInput,
  config: GenerationConfig,
  onProgress?: (percent: number) => void
): Promise<Result<GenerationResult, string>>
```

**Output**
```typescript
{
  artifact: ArtifactType,           // The generated output (code, config, docs)
  validationResult?: ValidationResult, // Did generated code compile/validate?
  diagnostics?: DiagnosticType[],   // Warnings, errors, suggestions
  metadata: Record<string, unknown>
}
```

**Key Characteristics**
- Transforms a description or input into executable/deployable output
- Output is a code file, configuration file, or document
- May take seconds to minutes (longer than transformers)
- Optionally validates output (does generated code compile?)
- Often uses AI to assist generation

**Examples**
- SBOM Generator → produces software bill of materials from code
- GraphQL Schema Validator → generates migration files from schema changes

**Required Capabilities**
- (none by default)

**Optional Capabilities**
- `reporting` — Document generation process and result
- `ai-assisted` — Use LLM to assist generation

---

## 4. Transformer

**Purpose:** Maps an existing artifact from one format or protocol to another.

**Engine Contract**

```typescript
export async function transform(
  input: TransformationInput,
  config: TransformationConfig
): Promise<Result<TransformationResult, string>>
```

**Output**
```typescript
{
  output: OutputType,               // Transformed artifact
  diagnostics?: DiagnosticType[],   // Parse warnings, mapping issues
  warnings?: string[],              // e.g., "Info lost in translation"
  metadata: Record<string, unknown>
}
```

**Key Characteristics**
- Synchronous or near-synchronous (request-scoped)
- No background jobs (fast enough for HTTP request)
- Converts between protocols or formats with zero loss of information
- Mapping is deterministic and repeatable
- Most transformations complete in seconds

**Examples**
- MCP Gateway → converts gRPC calls to HTTP, GraphQL to REST
- OpenAPI → Swagger converter

**Required Capabilities**
- (none by default)

**Optional Capabilities**
- `transformation` — Can produce multiple output formats
- `streaming` — Can stream output for large transformations

---

## 5. Runtime Middleware

**Purpose:** Intercepts requests, evaluates policy, returns allow/block/transform decision.

**Engine Contract**

```typescript
export async function evaluate(
  request: RequestType,
  context: PolicyContext
): Promise<Result<PolicyDecision, string>>
```

**Output**
```typescript
{
  action: "allow" | "block" | "transform" | "rate-limit",
  transformed?: RequestType,       // If action is "transform"
  reason: string,                  // Why this decision
  metadata: Record<string, unknown>
}
```

**Key Characteristics**
- Executes inline on every request (lowest latency)
- No background jobs
- Caches policy decisions for performance
- Produces analytics events (sampled, not persisted per request)
- No document-style reporting

**Examples**
- OAuth PKCE Middleware → validates authorization flow
- Prompt Injection Shield → evaluates request for injection attempts
- GraphQL Rate Limiter → decides allow/rate-limit per user

**Required Capabilities**
- (none by default)

**Optional Capabilities**
- `policy` — Policy configuration UI
- `ai-assisted` — Use LLM for intelligent evaluation (Prompt Injection Shield)

---

## 6. Gateway

**Purpose:** Manages endpoint configurations, protocol translation, traffic routing.

**Engine Contract**

```typescript
export async function process(
  request: RequestType,
  routingConfig: RoutingConfig
): Promise<Result<GatewayResult, string>>
```

**Output**
```typescript
{
  forwardedRequest: RequestType,    // To upstream service
  transformedResponse?: ResponseType, // Optional response transformation
  diagnostics?: DiagnosticType[],   // Routing logs
  metadata: Record<string, unknown>
}
```

**Key Characteristics**
- Routes requests to multiple upstream services
- Transforms request/response at protocol level
- Caches configuration; changes are sync
- Produces traffic analytics (sampled)
- No document-style reporting

**Examples**
- MCP Gateway → routes to multiple MCP servers, translates protocols

**Required Capabilities**
- (none by default)

**Optional Capabilities**
- `transformation` — Can transform request/response
- `policy` — Policy-based routing decisions

---

## Capability Composition

Capabilities are optional add-ons declared in `product.manifest.ts`:

```typescript
export const manifest: ProductManifest = {
  id: "jwt-scanner",
  displayName: "JWT Scanner",
  primaryArchetype: "analyzer",
  
  capabilities: [
    "reporting",    // Can generate PDF reports
    "scheduling",   // Can run on schedule (nightly scans)
  ],
  
  requiresWorker: true,    // Needs background job processing
  requiresAIProvider: false,
};
```

### Reporting Capability

```typescript
export interface ReportTemplate {
  name: string;
  format: "json" | "markdown" | "html" | "pdf";
  template: (data: TData) => Promise<string>;
}

export async function generateReport(
  findings: Finding[],
  template: ReportTemplate
): Promise<{ format: string; content: string }> {
  // Produces a report document from findings
}
```

### Scheduling Capability

```typescript
export const schedules = [
  {
    name: "nightly-scan",
    cron: "0 2 * * *",  // 2 AM every day
    job: "analyze",
  },
];
```

### Remediation Capability

```typescript
export interface Remediation {
  id: string;
  findingId: string;
  type: "sql" | "config" | "code";
  content: string;
  validated: boolean;
}

export async function applyRemediation(
  remediationId: string
): Promise<Result<RemediationResult, string>> {
  // Executes the remediation (runs SQL, commits config change, etc.)
}
```

### AI-Assisted Capability

```typescript
// Requires requiresAIProvider: true
import { aiModelPort } from "@/providers";

export async function enhanceAnalysis(
  findings: Finding[]
): Promise<Finding[]> {
  // Use AIModelPort to provide context, explanations, or auto-fixes
  const completion = await aiModelPort.complete(
    `Explain these security findings: ${JSON.stringify(findings)}`
  );
  return findings.map((f) => ({ ...f, explanation: completion }));
}
```

### Streaming Capability

Products using streaming typically have a Transformer archetype:

```typescript
export async function* transformStream(input: Input) {
  // Generator function yields chunks of output
  for await (const chunk of sourceStream) {
    yield transform(chunk);
  }
}
```

---

## Product Assignments (All 20)

| # | Product | Archetype | Capabilities | Worker? |
|---|---------|-----------|-------------|---------|
| 1 | MCP Gateway | Gateway | transformation, policy | No |
| 2 | MCP Security Auditor | Analyzer | reporting, scheduling | Yes |
| 3 | Prompt Injection Shield | Middleware | policy, ai-assisted | No |
| 4 | AI Agent Deadlock Interceptor | Middleware | policy, ai-assisted | No |
| 5 | Next.js Action Security Auditor | Analyzer | reporting | Yes |
| 6 | Tree-Sitter AST Scanner | Analyzer | reporting, scheduling | Yes |
| 7 | OpenAPI Drift Detector | Analyzer | reporting | Yes |
| 8 | GraphQL N+1 Inspector | Analyzer | reporting | Yes |
| 9 | PostgreSQL EXPLAIN Repair | Analyzer | reporting, remediation, optimization | Yes |
| 10 | PostgreSQL Bloat Analyzer | Analyzer | reporting, remediation | Yes |
| 11 | pgvector HNSW Optimizer | Optimizer | reporting, remediation | Yes |
| 12 | K8s RBAC Analyzer | Analyzer | reporting, scheduling | Yes |
| 13 | K8s Secret Scanner | Analyzer | reporting, scheduling | Yes |
| 14 | K8s Right-Sizing | Optimizer | reporting, remediation | Yes |
| 15 | OAuth PKCE Middleware | Middleware | policy | No |
| 16 | JWT Scanner | Analyzer | reporting | Yes |
| 17 | GraphQL Rate Limiter | Middleware | policy | No |
| 18 | SBOM Generator | Generator | reporting | Yes |
| 19 | CVE Risk Analyzer | Analyzer | reporting, scheduling, ai-assisted | Yes |
| 20 | License Compliance Scanner | Analyzer | reporting, scheduling | Yes |

---

## Choosing an Archetype

Ask these questions:

1. **Does your product identify problems?** → Analyzer
2. **Does it measure current state and propose improvements?** → Optimizer
3. **Does it create a new artifact (code, config, docs)?** → Generator
4. **Does it convert between formats?** → Transformer
5. **Does it evaluate requests in real-time?** → Runtime Middleware
6. **Does it route traffic and manage endpoints?** → Gateway

Most products fit squarely into one archetype. Some (like "PostgreSQL EXPLAIN Repair") span two (Analyzer + Optimizer), but have a **primary** archetype that determines the engine contract.

---

## See Also

- [domain-engine.md](.ai/patterns/domain-engine.md) — Implement an engine
- [Acquisition Guide](./ACQUISITION-GUIDE.md) — Extract a product

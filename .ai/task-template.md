# Forge AI Task Template

All AI tasks must follow this contract.

---

## Task Metadata

```
Phase:        [Bootstrap | Phase 2 | Phase 3 | Product 1-20 | Other]
Objective:    [Single sentence describing the goal]
Scope:        [Files/packages affected]
Constraints:  [What is NOT allowed]
Definition of Done: [How to verify completion]
```

---

## Task Structure

### 1. Overview

Brief description of what needs to be done and why.

**Constraints (MUST FOLLOW):**
- List any architectural boundaries
- List any frozen principles that apply
- List technologies that are forbidden
- List imports that are forbidden

### 2. Acceptance Criteria

```
[ ] Criterion 1: [specific, testable outcome]
[ ] Criterion 2: [specific, testable outcome]
[ ] Criterion 3: [specific, testable outcome]
```

### 3. Files Allowed to Modify

```
Allowed:
  - src/domain/
  - src/features/
  - src/db/
  - tests/

Forbidden:
  - /.ai/
  - /packages/
  - Root config files
```

### 4. Pre-Implementation Checks

Before writing code:

```
[ ] Architecture rules reviewed (.ai/architecture-rules.md)
[ ] Import boundaries checked (.ai/boundaries.md)
[ ] Relevant pattern reviewed (.ai/patterns/)
[ ] No secrets hardcoded
[ ] No TODO comments without context
[ ] No speculative abstractions
```

### 5. Implementation Checklist

During implementation:

```
[ ] Code follows pattern from .ai/patterns/
[ ] Domain logic is pure (zero infrastructure imports)
[ ] Server Actions use Result type
[ ] All inputs validated with Zod
[ ] Database queries use withOrg() scoping
[ ] Tests added for new functionality
[ ] ESLint passes (pnpm lint)
[ ] TypeScript strict mode passes (pnpm typecheck)
[ ] No console errors in dev
```

### 6. Testing

```
Unit Tests:
  [ ] Domain logic tested in isolation
  [ ] All branches covered (success + error)

Integration Tests:
  [ ] Feature works end-to-end
  [ ] Auth flow validated
  [ ] Database updates verified

Conformance Tests (if port/adapter):
  [ ] New adapter passes conformance suite
```

### 7. Documentation

```
[ ] Affected .ai/ files updated (if boundaries changed)
[ ] Code comments added for non-obvious logic
[ ] Relevant docs/ files updated
[ ] No stub documentation
```

### 8. Deployment Readiness

```
[ ] Docker builds successfully
[ ] docker-compose up works locally
[ ] No untracked env vars
[ ] Secrets NOT committed
[ ] Backward compatible (if applicable)
```

---

## Example: Product Feature Task

### Overview

Add analysis result reporting to JWT Scanner product.

**Constraints:**
- Domain engine remains pure (no report generation in engine.ts)
- Reporting uses `packages/reporting` port
- Report generation happens in Server Action, not domain
- No vendor SDK imports outside adapters

### Acceptance Criteria

```
[ ] JWT Scanner domain engine produces findings
[ ] Server Action generates report from findings
[ ] Report export available in JSON + Markdown
[ ] E2E test verifies report download
[ ] Product checklist updated with reporting capability
```

### Files Allowed

```
Allowed:
  apps/jwt-scanner/src/features/
  apps/jwt-scanner/src/domain/
  apps/jwt-scanner/e2e/

Forbidden:
  .ai/
  packages/
```

### Pre-Implementation

```
[ ] Reviewed packages/reporting/ port
[ ] Reviewed patterns/server-action.md
[ ] Confirmed JWT Scanner manifest has "reporting" capability
```

### Implementation

```
[ ] Created domain/report-generator.ts (pure function)
[ ] Created features/reporting/actions.ts (Server Action)
[ ] Added Zod schema for report inputs
[ ] Added withOrg() scoping for queries
[ ] Domain uses Result type
[ ] pnpm lint passes
[ ] pnpm typecheck passes
[ ] Added unit tests for report logic
[ ] Added E2E test for report download
```

### Testing

```
Unit:
  [ ] report-generator returns correct structure
  [ ] Error handling verified

Integration:
  [ ] User can start analysis, generate report, download
  [ ] Report contains expected data

Conformance:
  [ ] Report adapter passes reporting conformance suite
```

### Documentation

```
[ ] docs/REPORTING.md added to product docs
[ ] Updated product.manifest.ts with "reporting" capability
[ ] Commented non-obvious report logic
```

### Deployment

```
[ ] docker compose up works
[ ] Report files not in .dockerignore
[ ] No API keys in report output
```

---

## Critical Rules (Always Apply)

1. **Architecture violations fail**. If task conflicts with frozen principles (P1-P22), escalate rather than override.
2. **Domain stays pure**. Never import infrastructure into `src/domain/`.
3. **No vendor SDK leakage**. Vendor SDKs appear only in adapters, imported only by `providers.ts`.
4. **Boundaries enforce**. ESLint, TypeScript, and arch-check tools will catch violations.
5. **Tests prove correctness**. No code without tests.
6. **Docs gate launch**. Missing documentation blocks deployment.

---

## Task Completion Verification

Run these commands before marking complete:

```bash
pnpm install           # No new packages without approval
pnpm lint              # ESLint passes
pnpm typecheck         # TypeScript passes
pnpm test              # Unit + integration tests pass
pnpm build             # Build succeeds
pnpm arch-check        # Architecture validation passes
docker compose up      # Local stack works
```

If all pass, task is complete. If any fail, update the code and re-run.


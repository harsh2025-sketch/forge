# Server Action Pattern

## Location
`apps/[product]/src/features/[feature]/actions.ts`

## Template

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Result } from "@forge/shared";
import { withOrg } from "@forge/db";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { authPort } from "@/providers";

// 1. Input schema
const InputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});
type Input = z.infer<typeof InputSchema>;

// 2. Validation
async function validateInput(raw: unknown): Promise<Result<Input, string>> {
  try {
    return { ok: true, value: InputSchema.parse(raw) };
  } catch (error) {
    return { ok: false, error: "Invalid input" };
  }
}

// 3. Authorization
async function authorize(orgId: string): Promise<Result<void, string>> {
  const user = await authPort.requireUser();
  const org = await authPort.requireOrganization(orgId);
  if (!org) return { ok: false, error: "Organization not found" };
  return { ok: true, value: undefined };
}

// 4. Business logic
async function executeLogic(
  input: Input,
  orgId: string
): Promise<Result<{ id: string }, string>> {
  try {
    const [inserted] = await db
      .insert(schema.feature_items)
      .values({
        organization_id: orgId,
        name: input.name,
        description: input.description,
      })
      .returning({ id: schema.feature_items.id });

    return { ok: true, value: inserted };
  } catch (error) {
    return { ok: false, error: "Failed to create item" };
  }
}

// 5. Public action
export async function createFeatureItem(
  orgId: string,
  raw: unknown
): Promise<Result<{ id: string }, string>> {
  // Validate input
  const input = await validateInput(raw);
  if (!input.ok) return input;

  // Authorize
  const authResult = await authorize(orgId);
  if (!authResult.ok) return authResult;

  // Execute
  const result = await executeLogic(input.value, orgId);
  if (!result.ok) return result;

  // Revalidate cache
  revalidatePath(`/org/${orgId}`);

  return result;
}
```

## Key Constraints

- Always use `Result<T, E>` type.
- Always validate input with Zod.
- Always authorize with authPort.
- Always use `withOrg()` scoping for queries.
- Separate concerns: validation → authorization → logic.
- Use `revalidatePath()` or `revalidateTag()` for ISR.
- Never throw exceptions; return Result.

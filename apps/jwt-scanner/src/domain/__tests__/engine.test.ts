import { describe, expect, it } from "vitest";
import { ProductEngine } from "../engine.js";

describe("ProductEngine", () => {
  const config = { maxFindings: 100 };
  const VALID_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.s0m3-s1gn4tur3";

  it("rejects invalid input with an error Result", async () => {
    const engine = new ProductEngine();
    for (const token of ["", "not-a-jwt", "a.b"]) {
      const result = await engine.execute({ token }, config, () => {});
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/Invalid input/);
    }
  });

  it("rejects invalid config with an error Result", async () => {
    const engine = new ProductEngine();
    const result = await engine.execute({ token: VALID_TOKEN }, { maxFindings: 0 }, () => {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Invalid config/);
  });

  it("accepts valid input and reports an empty result on the skeleton", async () => {
    const engine = new ProductEngine();
    const progress: number[] = [];
    const result = await engine.execute({ token: VALID_TOKEN }, config, (percent) => progress.push(percent));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary.totalFindings).toBe(0);
      expect(result.value.findings).toEqual([]);
      expect(progress).toContain(100);
    }
  });
});

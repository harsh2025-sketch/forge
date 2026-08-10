import { describe, expect, it } from "vitest";
import {
  type Result,
  err,
  isErr,
  isOk,
  map,
  ok,
  tryCatch,
  unwrap,
  unwrapOr,
} from "../result.js";

describe("Result Primitive", () => {
  describe("ok constructor", () => {
    it("creates an Ok result with a value", () => {
      const res = ok(42);
      expect(res.ok).toBe(true);
      expect(res.value).toBe(42);
    });

    it("creates an Ok result with void/undefined value", () => {
      const res = ok();
      expect(res.ok).toBe(true);
      expect(res.value).toBeUndefined();
    });

    it("creates an Ok result with complex object", () => {
      const payload = { id: "user-123", name: "Alice" };
      const res = ok(payload);
      expect(res.ok).toBe(true);
      expect(res.value).toEqual(payload);
    });
  });

  describe("err constructor", () => {
    it("creates an Err result with a string error", () => {
      const res = err("Something failed");
      expect(res.ok).toBe(false);
      expect(res.error).toBe("Something failed");
    });

    it("creates an Err result with an Error instance", () => {
      const errorObj = new Error("Operation failed");
      const res = err(errorObj);
      expect(res.ok).toBe(false);
      expect(res.error).toBe(errorObj);
      expect(res.error.message).toBe("Operation failed");
    });
  });

  describe("type guards", () => {
    it("isOk returns true for Ok and false for Err", () => {
      const success: Result<number, string> = ok(10);
      const failure: Result<number, string> = err("error");

      expect(isOk(success)).toBe(true);
      expect(isOk(failure)).toBe(false);

      if (isOk(success)) {
        const val: number = success.value;
        expect(val).toBe(10);
      }
    });

    it("isErr returns true for Err and false for Ok", () => {
      const success: Result<number, string> = ok(10);
      const failure: Result<number, string> = err("error");

      expect(isErr(failure)).toBe(true);
      expect(isErr(success)).toBe(false);

      if (isErr(failure)) {
        const e: string = failure.error;
        expect(e).toBe("error");
      }
    });

    it("works with plain object literals matching Result shape", () => {
      const rawOk: Result<string, string> = { ok: true, value: "hello" };
      const rawErr: Result<string, string> = { ok: false, error: "bad" };

      expect(isOk(rawOk)).toBe(true);
      expect(isErr(rawErr)).toBe(true);
    });
  });

  describe("unwrap", () => {
    it("returns value when Ok", () => {
      const res = ok("success-value");
      expect(unwrap(res)).toBe("success-value");
    });

    it("throws Error instance when Err contains Error", () => {
      const customError = new Error("Custom failure");
      const res = err(customError);
      expect(() => unwrap(res)).toThrow(customError);
    });

    it("throws Error with message when Err contains string", () => {
      const res = err("Not found");
      expect(() => unwrap(res)).toThrow("Not found");
    });

    it("throws Error with stringified details when Err is an object", () => {
      const res = err({ code: "ERR", reason: "missing" });
      expect(() => unwrap(res)).toThrow('{"code":"ERR","reason":"missing"}');
    });
  });

  describe("unwrapOr", () => {
    it("returns value when Ok", () => {
      const res: Result<number, string> = ok(100);
      expect(unwrapOr(res, 0)).toBe(100);
    });

    it("returns fallback when Err", () => {
      const res: Result<number, string> = err("failed");
      expect(unwrapOr(res, 0)).toBe(0);
    });
  });

  describe("map", () => {
    it("transforms value when Ok", () => {
      const res = ok(5);
      const mapped = map(res, (n) => n * 2);
      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toBe(10);
      }
    });

    it("leaves Err untouched when Err", () => {
      const res: Result<number, string> = err("original error");
      const mapped = map(res, (n) => n * 2);
      expect(mapped.ok).toBe(false);
      if (!mapped.ok) {
        expect(mapped.error).toBe("original error");
      }
    });
  });

  describe("tryCatch", () => {
    it("wraps successful synchronous function in Ok", () => {
      const res = tryCatch(() => JSON.parse('{"key":"value"}'));
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toEqual({ key: "value" });
      }
    });

    it("wraps throwing synchronous function in Err", () => {
      const res = tryCatch(() => JSON.parse("invalid-json{"));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeInstanceOf(Error);
      }
    });

    it("uses custom error mapper when provided", () => {
      const res = tryCatch(
        () => {
          throw new Error("Disk full");
        },
        (caught) => `Mapped: ${(caught as Error).message}`
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("Mapped: Disk full");
      }
    });

    it("handles non-Error thrown objects", () => {
      const res = tryCatch(() => {
        throw "String error thrown";
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeInstanceOf(Error);
        expect(res.error.message).toBe("String error thrown");
      }
    });
  });
});

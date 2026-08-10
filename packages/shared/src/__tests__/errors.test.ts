import { describe, expect, it } from "vitest";
import {
  AppError,
  isAppError,
  toAppError,
} from "../errors.js";

describe("Error Primitives", () => {
  describe("AppError base class", () => {
    it("creates an AppError with default options", () => {
      const error = new AppError("Base failure");
      expect(error.message).toBe("Base failure");
      expect(error.name).toBe("AppError");
      expect(error.code).toBe("APP_ERROR");
      expect(error.details).toBeUndefined();
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it("creates an AppError with custom options", () => {
      const cause = new Error("Root cause");
      const error = new AppError("Operation failed", {
        code: "CUSTOM_CODE",
        details: { step: 2 },
        cause,
      });

      expect(error.message).toBe("Operation failed");
      expect(error.code).toBe("CUSTOM_CODE");
      expect(error.details).toEqual({ step: 2 });
      expect(error.cause).toBe(cause);
    });
  });

  describe("Helper functions", () => {
    it("isAppError returns true only for AppError instances", () => {
      expect(isAppError(new AppError("fail"))).toBe(true);
      expect(isAppError(new Error("standard error"))).toBe(false);
      expect(isAppError("string error")).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError({})).toBe(false);
    });

    it("toAppError preserves existing AppError", () => {
      const existing = new AppError("Already an AppError", { code: "EXISTING" });
      const result = toAppError(existing);
      expect(result).toBe(existing);
      expect(result.code).toBe("EXISTING");
    });

    it("toAppError converts standard Error to AppError with cause", () => {
      const standard = new Error("DB crash");
      const converted = toAppError(standard);
      expect(converted).toBeInstanceOf(AppError);
      expect(converted.message).toBe("DB crash");
      expect(converted.cause).toBe(standard);
    });

    it("toAppError converts string error", () => {
      const converted = toAppError("Something went wrong");
      expect(converted).toBeInstanceOf(AppError);
      expect(converted.message).toBe("Something went wrong");
    });

    it("toAppError converts unknown object with fallback message", () => {
      const raw = { foo: "bar" };
      const converted = toAppError(raw, "Custom fallback");
      expect(converted).toBeInstanceOf(AppError);
      expect(converted.message).toBe("Custom fallback");
      expect(converted.details).toEqual(raw);
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  createPaginatedResult,
  normalizePaginationParams,
} from "../pagination.js";

describe("Pagination Primitives", () => {
  describe("normalizePaginationParams", () => {
    it("returns default values when params are empty", () => {
      const normalized = normalizePaginationParams();
      expect(normalized).toEqual({
        page: 1,
        limit: 20,
        offset: 0,
      });
    });

    it("accepts valid page and limit", () => {
      const normalized = normalizePaginationParams({ page: 3, limit: 10 });
      expect(normalized).toEqual({
        page: 3,
        limit: 10,
        offset: 20,
      });
    });

    it("respects custom offset if provided", () => {
      const normalized = normalizePaginationParams({ page: 2, limit: 15, offset: 50 });
      expect(normalized).toEqual({
        page: 2,
        limit: 15,
        offset: 50,
      });
    });

    it("clamps page to minimum of 1", () => {
      const normalized = normalizePaginationParams({ page: -5, limit: 10 });
      expect(normalized.page).toBe(1);
      expect(normalized.offset).toBe(0);
    });

    it("clamps limit to maxLimit", () => {
      const normalized = normalizePaginationParams(
        { page: 1, limit: 500 },
        { maxLimit: 50 }
      );
      expect(normalized.limit).toBe(50);
    });

    it("handles non-finite / NaN values gracefully", () => {
      const normalized = normalizePaginationParams({
        page: Number.NaN,
        limit: Number.POSITIVE_INFINITY,
        offset: Number.NaN,
      });
      expect(normalized.page).toBe(1);
      expect(normalized.limit).toBe(20);
      expect(normalized.offset).toBe(0);
    });

    it("floors floating point values", () => {
      const normalized = normalizePaginationParams({ page: 2.7, limit: 10.9 });
      expect(normalized.page).toBe(2);
      expect(normalized.limit).toBe(10);
      expect(normalized.offset).toBe(10);
    });
  });

  describe("createPaginatedResult", () => {
    it("computes pagination metadata for middle page", () => {
      const items = ["a", "b", "c", "d", "e"];
      const result = createPaginatedResult(items, 50, { page: 2, limit: 5 });

      expect(result.items).toEqual(items);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 50,
        totalPages: 10,
        hasNextPage: true,
        hasPrevPage: true,
      });
    });

    it("handles first page correctly", () => {
      const items = [1, 2, 3];
      const result = createPaginatedResult(items, 10, { page: 1, limit: 3 });

      expect(result.pagination.hasPrevPage).toBe(false);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.totalPages).toBe(4);
    });

    it("handles last page correctly", () => {
      const items = [10];
      const result = createPaginatedResult(items, 10, { page: 4, limit: 3 });

      expect(result.pagination.hasPrevPage).toBe(true);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it("handles empty total items (0 total)", () => {
      const result = createPaginatedResult([], 0, { page: 1, limit: 20 });

      expect(result.items).toEqual([]);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it("handles page exceeding totalPages", () => {
      const result = createPaginatedResult([], 10, { page: 5, limit: 5 });

      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPrevPage).toBe(true);
    });
  });
});

/**
 * Pagination primitives and utility helpers for Forge.
 *
 * Provides vendor-neutral, database-neutral pagination types and helpers
 * for domain listings and API queries.
 */

export interface PaginationParams {
  readonly page?: number;
  readonly limit?: number;
  readonly offset?: number;
}

export interface NormalizedPaginationParams {
  readonly page: number;
  readonly limit: number;
  readonly offset: number;
}

export interface PaginationMetadata {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly pagination: PaginationMetadata;
}

export interface PaginationDefaults {
  readonly defaultPage?: number;
  readonly defaultLimit?: number;
  readonly maxLimit?: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEFAULT_MAX_LIMIT = 100;

/**
 * Normalizes input pagination parameters into sanitized, safe integers.
 */
export function normalizePaginationParams(
  params?: PaginationParams,
  defaults?: PaginationDefaults
): NormalizedPaginationParams {
  const defaultPage = defaults?.defaultPage ?? DEFAULT_PAGE;
  const defaultLimit = defaults?.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = defaults?.maxLimit ?? DEFAULT_MAX_LIMIT;

  const rawPage = params?.page;
  const rawLimit = params?.limit;
  const rawOffset = params?.offset;

  const page =
    typeof rawPage === "number" && !Number.isNaN(rawPage) && Number.isFinite(rawPage)
      ? Math.max(1, Math.floor(rawPage))
      : defaultPage;

  let limit =
    typeof rawLimit === "number" && !Number.isNaN(rawLimit) && Number.isFinite(rawLimit)
      ? Math.max(1, Math.floor(rawLimit))
      : defaultLimit;

  limit = Math.min(limit, maxLimit);

  const offset =
    typeof rawOffset === "number" && !Number.isNaN(rawOffset) && Number.isFinite(rawOffset) && rawOffset >= 0
      ? Math.floor(rawOffset)
      : (page - 1) * limit;

  return {
    page,
    limit,
    offset,
  };
}

/**
 * Calculates pagination metadata and wraps items in a PaginatedResult<T>.
 */
export function createPaginatedResult<T>(
  items: readonly T[],
  total: number,
  params: { readonly page: number; readonly limit: number } | NormalizedPaginationParams
): PaginatedResult<T> {
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
  const safeLimit = Math.max(1, Math.floor(params.limit));
  const safePage = Math.max(1, Math.floor(params.page));

  const totalPages = safeTotal === 0 ? 1 : Math.ceil(safeTotal / safeLimit);
  const hasNextPage = safePage < totalPages;
  const hasPrevPage = safePage > 1;

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: safeTotal,
      totalPages,
      hasNextPage,
      hasPrevPage,
    },
  };
}

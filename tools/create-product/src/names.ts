/**
 * Product identifier helpers for the Forge V3 scaffolding tooling.
 *
 * The product id follows the frozen manifest slug rule from @forge/config:
 * /^[a-z0-9][a-z0-9-]*[a-z0-9]$/
 */

const PRODUCT_ID_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

/** Returns true when the value is a valid Forge product id (slug). */
export function isValidProductId(value: string): boolean {
  return PRODUCT_ID_RE.test(value);
}

/** Converts a slug id into a human display name ("jwt-scanner" -> "Jwt Scanner"). */
export function toHumanName(id: string): string {
  return id
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Converts a product id into a PostgreSQL schema name ("jwt-scanner" -> "jwt_scanner"). */
export function schemaName(id: string): string {
  return id.replace(/-/g, "_");
}

/**
 * Deterministically derives a product id from an arbitrary directory name.
 * Non-slug characters become hyphens; runs of hyphens collapse; leading and
 * trailing hyphens are removed. Returns undefined when no valid id can be
 * derived (for example an empty or purely numeric-punctuation name).
 */
export function slugifyProductId(value: string): string | undefined {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!isValidProductId(slug)) return undefined;
  return slug;
}

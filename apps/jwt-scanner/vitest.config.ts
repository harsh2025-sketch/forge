/**
 * JWT Scanner Vitest configuration (product-local test setup).
 *
 * - Resolves the `@/` import alias the same way Next.js and TypeScript do
 *   (tsconfig paths), so feature modules are tested as they are wired.
 * - Uses the automatic JSX runtime for component tests (matches the
 *   repository's react-jsx convention used by @forge/ui).
 */

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

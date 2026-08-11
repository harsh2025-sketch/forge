/** @type {import('next').NextConfig} */
const nextConfig = {
  // Forge workspace packages ship compiled ESM + type declarations from their
  // dist output. Next.js externalizes node_modules packages by default, which
  // would load the pre-built dist — that is correct for @forge/* packages
  // (turbo builds them first). transpilePackages is still required so that
  // Next.js can resolve the packages' ESM exports through the pnpm workspace
  // layout and so that client components can bundle React-based Forge
  // packages (@forge/ui) that are not otherwise compiled by Next.
  transpilePackages: [
    "@forge/ui",
    "@forge/shared",
    "@forge/domain",
    "@forge/config",
    "@forge/auth",
    "@forge/billing",
    "@forge/reporting",
    "@forge/db",
    "@forge/testing",
  ],
  eslint: {
    // The repository enforces linting through `pnpm lint` (root eslint
    // config). Next.js runs its own eslint pass during build; deferring it
    // keeps a single lint gate and avoids a second, Next-specific lint run.
    ignoreDuringBuilds: true,
  },
  // Server Actions are enabled by default in Next.js 15 and the product's
  // action payloads (compact JWTs + project names) are far below the default
  // body size limit, so no serverActions tuning is required here.
  webpack: (config) => {
    // The repository's source uses NodeNext-style `.js` specifiers that point
    // at `.ts`/`.tsx` sources (e.g. `import { x } from "./parser.js"`). Map
    // them so webpack resolves the TypeScript files.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };
    return config;
  },
};

export default nextConfig;

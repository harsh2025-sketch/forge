# syntax=docker/dockerfile:1
#
# JWT Scanner — web process image (frozen principle P16, V3 §13.2).
#
# The product is part of the Forge pnpm workspace, so the image is built from
# the repository root: the whole workspace is copied, dependencies are
# installed with the frozen lockfile, everything is compiled with Turbo, and
# the runner stage keeps only the build outputs plus node_modules. The image
# runs as the non-root `node` user; secrets are injected at runtime through
# environment variables, never baked into the image.
#
# Build (from the repository root):
#   docker build -f apps/jwt-scanner/Dockerfile -t jwt-scanner:latest .
#
# The product has no worker process (requiresWorker: false in
# product.manifest.ts), so there is no Dockerfile.worker.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# ---- dependencies ---------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json tsconfig.json eslint.config.js .prettierrc.json .prettierignore ./
COPY packages ./packages
COPY apps ./apps
COPY tools ./tools
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# ---- build -----------------------------------------------------------------
FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages ./packages
COPY --from=deps /repo/apps ./apps
COPY --from=deps /repo/tools ./tools
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.json ./
RUN pnpm build

# ---- runner -----------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml /repo/turbo.json /repo/tsconfig.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/tools ./tools
COPY --from=build /repo/apps/jwt-scanner ./apps/jwt-scanner

WORKDIR /repo/apps/jwt-scanner
EXPOSE 3000
USER node
CMD ["pnpm", "start"]

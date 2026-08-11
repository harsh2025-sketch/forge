# Forge documentation validation

Run the documentation gate from the repository root:

```bash
pnpm validate-docs
```

The validator checks that the framework and governance documents used to define V3 exist and remain substantive. It also verifies the P1–P22 sequence, required master-architecture sections, and a `.ai/boundaries.md` section for every discovered framework package.

For every discovered `apps/*` workspace package it requires the product documents explicitly enumerated by the frozen V3 tree:

- `ARCHITECTURE.md`
- `SETUP.md`
- `DEPLOYMENT.md`
- `DATABASE.md`
- `PROVIDERS.md`
- `API.md`
- `TESTING.md`
- `SECURITY.md`
- `OPERATIONS.md`
- `ACQUISITION.md`

The frozen prose calls this set “all 11” while its repository tree and governance checklist enumerate the ten names above. The validator follows the explicit frozen filename list rather than inventing an eleventh document.

Each product document must contain a title, a section, more than 200 words, and no stub marker. Setup, database, providers, security, and acquisition documents also require their architecture-specified subject sections. Validation reports stable rule names and paths and exits non-zero on drift; it never rewrites documentation.

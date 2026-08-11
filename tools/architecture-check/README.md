# Forge architecture check

`@forge/architecture-check` converts the frozen V3 package graph into a deterministic repository gate.

Run it from the repository root:

```bash
pnpm arch-check
```

The command discovers workspace packages and source files from the checkout; it does not rely on a snapshot of current filenames. It validates package placement, workspace dependency protocol, package and import direction, ports and adapters, adapter ownership, vendor SDK containment, domain purity, testing/reporting/UI neutrality, prohibited infrastructure, application isolation, adapter wiring, package cycles, tenant-query scoping, and the shared platform `product_id` invariants.

Diagnostics use stable rule names and include the package, file, line, column, and import/dependency where applicable. Errors return exit code `1`; warnings such as a potentially unused dependency do not block. Invalid CLI usage returns exit code `2`.

The checker uses only the local checkout and TypeScript parser. It does not start an application, connect to a database, call a provider, or require credentials.

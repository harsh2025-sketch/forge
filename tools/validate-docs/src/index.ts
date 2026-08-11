import fs from "node:fs";
import path from "node:path";

export const REQUIRED_PRODUCT_DOCUMENTS = [
  "ARCHITECTURE.md",
  "SETUP.md",
  "DEPLOYMENT.md",
  "DATABASE.md",
  "PROVIDERS.md",
  "API.md",
  "TESTING.md",
  "SECURITY.md",
  "OPERATIONS.md",
  "ACQUISITION.md",
] as const;

const REQUIRED_FRAMEWORK_DOCUMENTS = [
  "README.md",
  "docs/FRAMEWORK.md",
  "docs/ARCHETYPES.md",
  "docs/architecture/FORGE-MASTER-ARCHITECTURE-V3.md",
  ".ai/rules.md",
  ".ai/boundaries.md",
  ".ai/architecture-rules.md",
] as const;

const REQUIRED_MASTER_SECTIONS = [
  "## 1. Final Architecture Principles",
  "## 3. Final Repository Architecture",
  "## 4. Final Dependency Graph",
  "## 13. Final CI/CD Architecture",
  "## 15. Final Architecture-Check System",
  "## 20. Final 14-Day Framework Implementation Plan",
] as const;

const REQUIRED_PRODUCT_SECTION: Readonly<Partial<Record<(typeof REQUIRED_PRODUCT_DOCUMENTS)[number], RegExp>>> = {
  "SETUP.md": /environment/i,
  "DATABASE.md": /schema/i,
  "PROVIDERS.md": /replac|switch|migration/i,
  "SECURITY.md": /security model|threat|authentication|authorization/i,
  "ACQUISITION.md": /extraction|handoff|migration/i,
};

export interface DocumentationDiagnostic {
  readonly rule: string;
  readonly file: string;
  readonly message: string;
}

export interface DocumentationReport {
  readonly root: string;
  readonly productsChecked: number;
  readonly documentsChecked: number;
  readonly errors: readonly DocumentationDiagnostic[];
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function wordCount(markdown: string): number {
  return (markdown.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

function headings(markdown: string): string[] {
  return [...markdown.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1]?.trim() ?? "");
}

function isStub(markdown: string): boolean {
  return /\b(?:FIXME|TBD|TODO)\b|lorem ipsum|to be implemented|placeholder content/i.test(markdown);
}

function packageBoundaryPaths(root: string): string[] {
  const packagesRoot = path.join(root, "packages");
  if (!fs.existsSync(packagesRoot)) return [];
  const paths: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (["dist", "node_modules"].includes(entry.name)) continue;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && entry.name === "package.json") {
        paths.push(toPosix(path.relative(root, path.dirname(entryPath))));
      }
    }
  };
  visit(packagesRoot);
  return paths.sort();
}

function productPaths(root: string): string[] {
  const appsRoot = path.join(root, "apps");
  if (!fs.existsSync(appsRoot)) return [];
  return fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(appsRoot, entry.name, "package.json")))
    .map((entry) => `apps/${entry.name}`)
    .sort();
}

export function validateDocumentation(rootInput: string = process.cwd()): DocumentationReport {
  const root = path.resolve(rootInput);
  const errors: DocumentationDiagnostic[] = [];
  const checked = new Set<string>();
  const add = (rule: string, file: string, message: string): void => {
    errors.push({ rule, file, message });
  };

  for (const file of REQUIRED_FRAMEWORK_DOCUMENTS) {
    const absoluteFile = path.join(root, file);
    if (!fs.existsSync(absoluteFile)) {
      add("MISSING_FRAMEWORK_DOCUMENT", file, `Required framework/governance document ${file} is missing.`);
      continue;
    }
    checked.add(file);
    const markdown = fs.readFileSync(absoluteFile, "utf8");
    if (!/^#\s+\S/m.test(markdown)) {
      add("DOCUMENT_STRUCTURE", file, `${file} must have a level-one title.`);
    }
    if (wordCount(markdown) <= 100) {
      add("FRAMEWORK_DOCUMENT_STUB", file, `${file} has ${wordCount(markdown)} words; framework documentation must be substantive (> 100 words).`);
    }
  }

  const architectureRulesFile = ".ai/architecture-rules.md";
  const architectureRulesPath = path.join(root, architectureRulesFile);
  if (fs.existsSync(architectureRulesPath)) {
    const text = fs.readFileSync(architectureRulesPath, "utf8");
    const principles = [...text.matchAll(/^\*\*P(\d+)\s+—/gm)].map((match) => Number(match[1]));
    const expected = Array.from({ length: 22 }, (_, index) => index + 1);
    if (principles.length !== expected.length || principles.some((principle, index) => principle !== expected[index])) {
      add(
        "FROZEN_PRINCIPLES_DRIFT",
        architectureRulesFile,
        `Expected frozen principles P1 through P22 exactly once and in order; found ${principles.join(", ") || "none"}.`,
      );
    }
  }

  const masterFile = "docs/architecture/FORGE-MASTER-ARCHITECTURE-V3.md";
  const masterPath = path.join(root, masterFile);
  if (fs.existsSync(masterPath)) {
    const master = fs.readFileSync(masterPath, "utf8");
    for (const section of REQUIRED_MASTER_SECTIONS) {
      if (!master.includes(section)) {
        add("FROZEN_ARCHITECTURE_DRIFT", masterFile, `Frozen architecture section is missing: ${section}.`);
      }
    }
  }

  const boundariesFile = ".ai/boundaries.md";
  const boundariesPath = path.join(root, boundariesFile);
  if (fs.existsSync(boundariesPath)) {
    const boundaries = fs.readFileSync(boundariesPath, "utf8");
    for (const packagePath of packageBoundaryPaths(root)) {
      if (!boundaries.includes(`## ${packagePath}`)) {
        add(
          "UNDOCUMENTED_PACKAGE_BOUNDARY",
          boundariesFile,
          `Workspace package ${packagePath} has no package boundary section in ${boundariesFile}.`,
        );
      }
    }
  }

  const products = productPaths(root);
  for (const product of products) {
    const docsDirectory = path.join(root, product, "docs");
    for (const document of REQUIRED_PRODUCT_DOCUMENTS) {
      const file = `${product}/docs/${document}`;
      const absoluteFile = path.join(docsDirectory, document);
      if (!fs.existsSync(absoluteFile)) {
        add("MISSING_PRODUCT_DOCUMENT", file, `${product} is missing required product document ${document}.`);
        continue;
      }
      checked.add(file);
      const markdown = fs.readFileSync(absoluteFile, "utf8");
      const words = wordCount(markdown);
      if (words <= 200) {
        add("PRODUCT_DOCUMENT_STUB", file, `${file} has ${words} words; frozen V3 requires more than 200 words.`);
      }
      if (isStub(markdown)) {
        add("PRODUCT_DOCUMENT_STUB", file, `${file} contains a stub marker (TODO/TBD/FIXME/placeholder).`);
      }
      const documentHeadings = headings(markdown);
      if (!/^#\s+\S/m.test(markdown) || !/^##\s+\S/m.test(markdown)) {
        add("DOCUMENT_STRUCTURE", file, `${file} must contain a level-one title and at least one level-two section.`);
      }
      const requiredSection = REQUIRED_PRODUCT_SECTION[document];
      if (requiredSection !== undefined && !documentHeadings.some((heading) => requiredSection.test(heading))) {
        add("MISSING_REQUIRED_SECTION", file, `${file} is missing a required ${requiredSection.source} section.`);
      }
    }
  }

  errors.sort((left, right) => left.file.localeCompare(right.file) || left.rule.localeCompare(right.rule));
  return {
    root,
    productsChecked: products.length,
    documentsChecked: checked.size,
    errors,
  };
}

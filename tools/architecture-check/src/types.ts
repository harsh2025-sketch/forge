export type Severity = "error" | "warning";

export interface ArchitectureDiagnostic {
  readonly severity: Severity;
  readonly rule: string;
  readonly message: string;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly packageName?: string;
  readonly packagePath?: string;
  readonly specifier?: string;
}

export interface ArchitectureReport {
  readonly root: string;
  readonly packagesChecked: number;
  readonly filesChecked: number;
  readonly errors: readonly ArchitectureDiagnostic[];
  readonly warnings: readonly ArchitectureDiagnostic[];
}

export interface CheckOptions {
  readonly root?: string;
}

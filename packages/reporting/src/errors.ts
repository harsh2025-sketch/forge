/**
 * @forge/reporting — typed error surface.
 *
 * Extends the shared AppError base (V3: reporting → @forge/shared) so callers can
 * distinguish render/validation failures with stable machine-readable codes.
 */

import { AppError } from "@forge/shared";

/**
 * Raised when a report cannot be rendered (invalid template output, unsupported
 * format, unserializable value, ...).
 */
export class ReportRenderError extends AppError {
  constructor(message: string, options?: { readonly details?: unknown; readonly cause?: unknown }) {
    super(message, { code: "REPORT_RENDER_ERROR", ...options });
  }
}

/**
 * Raised when a report document does not satisfy the ReportDocument contract
 * (structural validation failure, not a rendering failure).
 */
export class ReportValidationError extends AppError {
  constructor(message: string, options?: { readonly details?: unknown; readonly cause?: unknown }) {
    super(message, { code: "REPORT_VALIDATION_ERROR", ...options });
  }
}

/**
 * Type guards mirroring @forge/shared conventions.
 */
export function isReportRenderError(error: unknown): error is ReportRenderError {
  return error instanceof ReportRenderError;
}

export function isReportValidationError(error: unknown): error is ReportValidationError {
  return error instanceof ReportValidationError;
}

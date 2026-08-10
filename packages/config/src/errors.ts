import { AppError } from "@forge/shared";

/**
 * Configuration error for Forge config kernel.
 *
 * Uses code CONFIG_ERROR. Details never contain secret values.
 */
export class ConfigError extends AppError {
  constructor(
    message: string,
    options?: { readonly cause?: unknown; readonly details?: unknown }
  ) {
    super(message, {
      code: "CONFIG_ERROR",
      cause: options?.cause,
      details: options?.details,
    });
    this.name = "ConfigError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Type guard for ConfigError.
 */
export function isConfigError(error: unknown): error is ConfigError {
  return error instanceof ConfigError;
}

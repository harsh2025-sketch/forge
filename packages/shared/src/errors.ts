/**
 * Error base types for Forge.
 *
 * Provides a vendor-neutral, transport-neutral base error class (AppError)
 * for structured error handling in the shared kernel.
 */

export interface AppErrorOptions {
  readonly code?: string;
  readonly details?: unknown;
  readonly cause?: unknown;
}

/**
 * Base error class for operational errors across the Forge framework.
 */
export class AppError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, options?: AppErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = this.constructor.name;
    this.code = options?.code ?? "APP_ERROR";
    this.details = options?.details;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Type guard to check if a value is an instance of AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Converts an unknown caught value into an AppError instance.
 */
export function toAppError(error: unknown, fallbackMessage = "An unexpected error occurred"): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, { cause: error });
  }

  if (typeof error === "string") {
    return new AppError(error);
  }

  return new AppError(fallbackMessage, { details: error });
}

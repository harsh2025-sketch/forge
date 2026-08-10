/**
 * Result<T, E> — Functional error handling primitive for Forge.
 *
 * All domain engine contracts, Server Actions, and internal operations
 * return a Result to make success and failure explicit without throwing exceptions.
 */

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Creates a successful Result containing a value.
 */
export function ok(): Ok<void>;
export function ok<T>(value: T): Ok<T>;
export function ok<T>(value?: T): Ok<T> {
  return { ok: true, value: value as T };
}

/**
 * Creates an error Result containing an error value.
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Type guard to check if a Result is Ok.
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * Type guard to check if a Result is Err.
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

/**
 * Returns the value if Ok, or throws the error if Err.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  if (result.error instanceof Error) {
    throw result.error;
  }
  throw new Error(
    typeof result.error === "string"
      ? result.error
      : JSON.stringify(result.error)
  );
}

/**
 * Returns the value if Ok, or the provided fallback if Err.
 */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

/**
 * Maps a Result<T, E> to Result<U, E> by applying a function to a contained Ok value.
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return err(result.error);
}

/**
 * Executes a synchronous function and wraps the result in a Result<T, E>.
 * Catches any thrown exceptions.
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  mapError?: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (caught) {
    if (mapError) {
      return err(mapError(caught));
    }
    const error =
      caught instanceof Error
        ? caught
        : new Error(typeof caught === "string" ? caught : String(caught));
    return err(error as unknown as E);
  }
}

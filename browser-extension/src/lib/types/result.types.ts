/**
 * Result Types
 * 
 * Standardized error handling with Result pattern.
 */

export type Result<T, E = Error> = Success<T> | Failure<E>

export interface Success<T> {
  success: true
  data: T
}

export interface Failure<E> {
  success: false
  error: E
}

/**
 * Create a success result
 */
export function success<T>(data: T): Success<T> {
  return { success: true, data }
}

/**
 * Create a failure result
 */
export function failure<E>(error: E): Failure<E> {
  return { success: false, error }
}

/**
 * Check if result is success
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.success
}

/**
 * Check if result is failure
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return !result.success
}

/**
 * Async result type for promises
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>

/**
 * Wrap a promise in a Result
 */
export async function wrapAsync<T>(
  promise: Promise<T>
): Promise<Result<T, Error>> {
  try {
    const data = await promise
    return success(data)
  } catch (error) {
    return failure(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Wrap a sync function in a Result
 */
export function wrapSync<T>(
  fn: () => T
): Result<T, Error> {
  try {
    const data = fn()
    return success(data)
  } catch (error) {
    return failure(error instanceof Error ? error : new Error(String(error)))
  }
}

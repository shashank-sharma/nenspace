/**
 * Error Message Utility
 * 
 * Provides a safe way to extract error messages from unknown types.
 */

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}


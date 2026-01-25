/**
 * Checks if an error is a PocketBase auto-cancellation error.
 * PocketBase auto-cancels duplicate requests to the same resource.
 * 
 * @param error - The error to check
 * @returns true if the error is an auto-cancellation error
 * 
 * @example
 * try {
 *   await pb.collection('items').getOne(id);
 * } catch (error) {
 *   if (isAutoCancelledError(error)) {
 *     // Silently ignore - expected behavior
 *     return;
 *   }
 *   throw error;
 * }
 */
export function isAutoCancelledError(error: unknown): boolean {
  if (!error) return false;
  
  // Try to extract error message
  let errorMessage = '';
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = String(error.message);
  }
  
  // Check for auto-cancellation message
  if (errorMessage.includes('autocancelled') || 
      errorMessage.includes('auto-cancelled')) {
    return true;
  }
  
  // Check for status code 0 (aborted request)
  if (error && typeof error === 'object' && 'status' in error && error.status === 0) {
    return true;
  }
  
  return false;
}

/**
 * Extracts a user-friendly error message from any error type.
 * Handles PocketBase errors, standard Errors, and unknown error types.
 * 
 * @param error - The error to extract message from
 * @param defaultMessage - Optional default message if extraction fails
 * @returns A user-friendly error message
 */
export function extractErrorMessage(error: unknown, defaultMessage = 'An error occurred'): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if ('data' in error && typeof error.data === 'object' && error.data !== null) {
      const data = error.data as Record<string, unknown>;
      if ('message' in data && typeof data.message === 'string') {
        return data.message;
      }
    }
  }
  
  return defaultMessage;
}

/**
 * Type guard to check if an error should be shown to the user.
 * Filters out auto-cancellation errors and other expected/ignorable errors.
 * 
 * @param error - The error to check
 * @returns true if the error should be shown to the user
 */
export function shouldShowErrorToUser(error: unknown): boolean {
  return !isAutoCancelledError(error);
}

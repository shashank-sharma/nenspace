export function isAutoCancelledError(error: unknown): boolean {
  if (!error) return false

  const errorMessage = error instanceof Error ? error.message : String(error)

  if (errorMessage.includes('autocancelled') ||
      errorMessage.includes('auto-cancelled')) {
    return true
  }

  if (error && typeof error === 'object' && 'status' in error && error.status === 0) {
    return true
  }

  return false
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'An unknown error occurred'
}

export async function handleAsyncError<T>(
  fn: () => Promise<T>,
  onError?: (error: unknown) => void
): Promise<T | null> {
  try {
    return await fn()
  } catch (error) {
    if (onError) {
      onError(error)
    }
    return null
  }
}


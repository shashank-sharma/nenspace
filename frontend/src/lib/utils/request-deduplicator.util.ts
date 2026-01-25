/**
 * Generic request deduplication utility.
 * Prevents multiple simultaneous requests to the same resource by caching promises.
 * Useful for preventing race conditions and duplicate API calls.
 * 
 * @example
 * const deduplicator = new RequestDeduplicator<string, User>();
 * 
 * async function loadUser(userId: string) {
 *   return deduplicator.dedupe(userId, async () => {
 *     return await api.getUser(userId);
 *   });
 * }
 * 
 * // Multiple calls return the same promise
 * const [user1, user2] = await Promise.all([
 *   loadUser('123'),  // Makes API call
 *   loadUser('123'),  // Reuses promise from first call
 * ]);
 */
export class RequestDeduplicator<TKey = string, TResult = unknown> {
  private readonly activeRequests = new Map<TKey, Promise<TResult>>();
  
  /**
   * Execute a request with deduplication.
   * If a request with the same key is already in progress, returns the existing promise.
   * Otherwise, executes the request function and caches the promise.
   * 
   * @param key - Unique identifier for this request
   * @param requestFn - Async function that performs the actual request
   * @returns Promise that resolves with the request result
   */
  async dedupe(key: TKey, requestFn: () => Promise<TResult>): Promise<TResult> {
    // Check for existing request
    const existing = this.activeRequests.get(key);
    if (existing) {
      return existing;
    }
    
    // Create new request
    const promise = requestFn().finally(() => {
      // Clean up when done (success or failure)
      this.activeRequests.delete(key);
    });
    
    this.activeRequests.set(key, promise);
    return promise;
  }
  
  /**
   * Check if a request is currently in progress for the given key.
   * 
   * @param key - The request key to check
   * @returns true if a request is in progress
   */
  isLoading(key: TKey): boolean {
    return this.activeRequests.has(key);
  }
  
  /**
   * Cancel/clear a specific request from the cache.
   * Note: This doesn't actually abort the request, just removes it from the cache.
   * 
   * @param key - The request key to clear
   */
  clear(key: TKey): void {
    this.activeRequests.delete(key);
  }
  
  /**
   * Clear all pending requests from the cache.
   * Note: This doesn't actually abort the requests, just removes them from the cache.
   */
  clearAll(): void {
    this.activeRequests.clear();
  }
  
  /**
   * Get the number of requests currently in progress.
   * 
   * @returns The number of active requests
   */
  get size(): number {
    return this.activeRequests.size;
  }
}

/**
 * Convenience function to create a typed request deduplicator.
 * 
 * @example
 * const loadUser = createDeduplicatedRequest<string, User>();
 * 
 * const user = await loadUser('123', () => api.getUser('123'));
 */
export function createDeduplicatedRequest<TKey = string, TResult = unknown>() {
  const deduplicator = new RequestDeduplicator<TKey, TResult>();
  return (key: TKey, requestFn: () => Promise<TResult>) => deduplicator.dedupe(key, requestFn);
}

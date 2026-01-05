/**
 * Shared utilities for activity tracking services
 */

/**
 * Optimized deep equal implementation with shallow comparison first
 * Used for comparing heartbeat data to detect changes
 */
export function deepEqual(a: any, b: any): boolean {
  // Quick reference equality check
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false
  
  // For objects, do shallow comparison first before deep comparison
  if (typeof a === 'object') {
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    
    if (keysA.length !== keysB.length) return false
    
    // Shallow comparison: check if all keys match and primitive values are equal
    let shallowMatch = true
    for (const key of keysA) {
      if (!keysB.includes(key)) {
        shallowMatch = false
        break
      }
      const valA = a[key]
      const valB = b[key]
      // If both are primitives and equal, continue (fast path)
      if (valA === valB || (valA == null && valB == null)) {
        continue
      }
      // If either is an object, need deep comparison
      if (typeof valA === 'object' || typeof valB === 'object') {
        if (!deepEqual(valA, valB)) {
          shallowMatch = false
          break
        }
      } else {
        // Primitives that don't match
        shallowMatch = false
        break
      }
    }
    
    return shallowMatch
  }
  
  return false
}


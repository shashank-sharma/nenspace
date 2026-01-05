/**
 * Ranking utilities for fuzzy matching and relevancy scoring
 * Inspired by modern search capabilities
 */

/**
 * Fuzzy matching - check if all query terms match in text (order-independent)
 * @returns true if ALL terms are found in the text (case-insensitive)
 */
export function fuzzyMatch(queryTerms: string[], text: string): boolean {
  const textLower = text.toLowerCase()
  return queryTerms.every(term => textLower.includes(term))
}

/**
 * Word relevancy scoring (0-1 range)
 * Exact word matches score higher than partial matches
 * Word-start matches score medium
 */
export function wordRelevancy(
  queryTerms: string[], 
  text: string, 
  boostExact: boolean = true
): number {
  const textLower = text.toLowerCase()
  const words = textLower.split(/\s+/)
  
  let totalScore = 0
  
  for (const term of queryTerms) {
    const termLower = term.toLowerCase()
    
    // Check for exact word match (highest score)
    if (words.includes(termLower)) {
      totalScore += 1
    }
    // Check for word start match (medium score)
    else if (words.some(word => word.startsWith(termLower))) {
      totalScore += 0.75
    }
    // Check for substring match (lower score)
    else if (textLower.includes(termLower)) {
      totalScore += 0.5
    }
  }
  
  // Average across all query terms
  return queryTerms.length > 0 ? totalScore / queryTerms.length : 0
}

/**
 * Recency scoring for tabs (0-1 range, more recent = higher)
 * Uses exponential decay with 90-day half-life
 */
export function recencyScore(timestamp: number): number {
  const now = Date.now()
  const ageInDays = (now - timestamp) / (1000 * 60 * 60 * 24)
  const halfLife = 90 // days
  
  // Exponential decay
  const score = Math.exp(-ageInDays / halfLife)
  return Math.max(0, Math.min(1, score))
}

/**
 * Combined scoring for tabs
 * Combines word relevancy (title weighted 2x more than URL) with recency
 */
export function tabScore(
  queryTerms: string[],
  title: string,
  url: string,
  lastAccessed?: number
): number {
  const titleScore = wordRelevancy(queryTerms, title, true)
  const urlScore = wordRelevancy(queryTerms, url, false)
  
  // Title matches weighted 2x more than URL
  const wordScore = (titleScore * 2 + urlScore) / 3
  
  // Apply recency boost if timestamp available
  let finalScore = wordScore
  if (lastAccessed) {
    const recency = recencyScore(lastAccessed)
    // Average word score with recency, but ensure word relevancy still dominates
    finalScore = (wordScore * 2 + recency) / 3
  }
  
  // Apply 8x boost so tabs don't get crowded out
  return finalScore * 8
}

/**
 * Command scoring - considers label, description, and keywords
 */
export function commandScore(
  queryTerms: string[],
  label: string,
  description: string,
  keywords: string[]
): number {
  const labelScore = wordRelevancy(queryTerms, label, true)
  const descScore = wordRelevancy(queryTerms, description, false)
  const keywordScore = Math.max(
    0,
    ...keywords.map(kw => wordRelevancy(queryTerms, kw, false))
  )
  
  // Label matches weighted highest, then keywords, then description
  return (labelScore * 3 + keywordScore * 2 + descScore) / 6
}

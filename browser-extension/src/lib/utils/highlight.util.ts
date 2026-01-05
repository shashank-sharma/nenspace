/**
 * Text highlighting utilities with XSS protection
 * Safe for use with Svelte's {@html} directive
 */

/**
 * Escape HTML entities to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }
  
  return text.replaceAll(/[&<>"']/g, char => escapeMap[char] || char)
}

/**
 * Escape regex special characters
 */
function escapeRegex(text: string): string {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
}

/**
 * Highlight matching query terms in text
 * Returns safe HTML string with <span class="match"> tags
 */
export function highlightMatches(text: string, queryTerms: string[]): string {
  if (!text || queryTerms.length === 0) {
    return escapeHtml(text)
  }
  
  // Escape HTML first for XSS protection
  let highlighted = escapeHtml(text)
  
  // Sort terms by length (longest first) to avoid partial replacements
  const sortedTerms = [...queryTerms].sort((a, b) => b.length - a.length)
  
  // Apply highlights for each term
  for (const term of sortedTerms) {
    if (!term) continue
    
    const escaped = escapeRegex(term)
    const regex = new RegExp(`(${escaped})`, 'gi')
    highlighted = highlighted.replaceAll(
      regex, 
      '<span class="match">$1</span>'
    )
  }
  
  return highlighted
}

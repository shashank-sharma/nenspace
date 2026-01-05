/**
 * Find Mode Utility
 * 
 * Provides text search functionality for finding text on the page.
 * Supports both forward and backward search with highlighting.
 */

export interface FindOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
  regex?: boolean
  backwards?: boolean
}

export interface FindResult {
  query: string
  matchCount: number
  currentMatch: number
  hasResults: boolean
}

class FindModeUtil {
  private currentQuery = ''
  private currentOptions: FindOptions = {}
  private searchResults: Range[] = []
  private currentMatchIndex = 0
  private originalSelection: Selection | null = null
  private isActive = false

  /**
   * Start find mode with the given query
   */
  startFind(query: string, options: FindOptions = {}): FindResult {
    this.currentQuery = query
    this.currentOptions = {
      caseSensitive: false,
      wholeWord: false,
      regex: false,
      backwards: false,
      ...options
    }

    this.isActive = true
    this.saveOriginalSelection()
    this.performSearch()

    return this.getCurrentResult()
  }

  /**
   * Update the current search query
   */
  updateQuery(query: string): FindResult {
    this.currentQuery = query
    this.performSearch()
    return this.getCurrentResult()
  }

  /**
   * Find next match
   */
  findNext(): FindResult {
    if (!this.isActive || this.searchResults.length === 0) {
      return this.getCurrentResult()
    }

    this.currentMatchIndex = (this.currentMatchIndex + 1) % this.searchResults.length
    this.highlightCurrentMatch()
    return this.getCurrentResult()
  }

  /**
   * Find previous match
   */
  findPrevious(): FindResult {
    if (!this.isActive || this.searchResults.length === 0) {
      return this.getCurrentResult()
    }

    this.currentMatchIndex = this.currentMatchIndex === 0 
      ? this.searchResults.length - 1 
      : this.currentMatchIndex - 1
    this.highlightCurrentMatch()
    return this.getCurrentResult()
  }

  /**
   * Exit find mode
   */
  exit(): void {
    this.clearHighlights()
    this.restoreOriginalSelection()
    this.isActive = false
    this.currentQuery = ''
    this.searchResults = []
    this.currentMatchIndex = 0
  }

  /**
   * Check if find mode is active
   */
  isFindModeActive(): boolean {
    return this.isActive
  }

  /**
   * Get current search result info
   */
  getCurrentResult(): FindResult {
    return {
      query: this.currentQuery,
      matchCount: this.searchResults.length,
      currentMatch: this.searchResults.length > 0 ? this.currentMatchIndex + 1 : 0,
      hasResults: this.searchResults.length > 0
    }
  }

  /**
   * Perform the actual search
   */
  private performSearch(): void {
    this.clearHighlights()
    this.searchResults = []

    if (!this.currentQuery.trim()) {
      return
    }

    const textNodes = this.getAllTextNodes()
    const searchPattern = this.createSearchPattern()

    for (const textNode of textNodes) {
      const matches = this.findMatchesInTextNode(textNode, searchPattern)
      this.searchResults.push(...matches)
    }

    if (this.searchResults.length > 0) {
      this.currentMatchIndex = 0
      this.highlightCurrentMatch()
    }
  }

  /**
   * Get all text nodes in the document
   */
  private getAllTextNodes(): Text[] {
    const textNodes: Text[] = []
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip script and style elements
          const parent = node.parentElement
          if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
            return NodeFilter.FILTER_REJECT
          }
          return NodeFilter.FILTER_ACCEPT
        }
      }
    )

    let node
    while (node = walker.nextNode()) {
      if (node.textContent?.trim()) {
        textNodes.push(node as Text)
      }
    }

    return textNodes
  }

  /**
   * Create search pattern based on options
   */
  private createSearchPattern(): RegExp {
    let pattern = this.currentQuery

    if (!this.currentOptions.regex) {
    // Escape special regex characters
    pattern = pattern.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
    }

    if (this.currentOptions.wholeWord) {
      pattern = `\\b${pattern}\\b`
    }

    const flags = this.currentOptions.caseSensitive ? 'g' : 'gi'
    return new RegExp(pattern, flags)
  }

  /**
   * Find matches in a text node
   */
  private findMatchesInTextNode(textNode: Text, pattern: RegExp): Range[] {
    const matches: Range[] = []
    const text = textNode.textContent ?? ''
    let match

    // Reset regex lastIndex
    pattern.lastIndex = 0

    while ((match = pattern.exec(text)) !== null) {
      const range = document.createRange()
      range.setStart(textNode, match.index)
      range.setEnd(textNode, match.index + match[0].length)
      matches.push(range)
    }

    return matches
  }

  /**
   * Highlight the current match
   */
  private highlightCurrentMatch(): void {
    if (this.searchResults.length === 0) return

    const currentRange = this.searchResults[this.currentMatchIndex]
    const selection = globalThis.getSelection()
    
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(currentRange)
      
      // Scroll the match into view
      currentRange.getBoundingClientRect()
      currentRange.startContainer.parentElement?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      })
    }
  }

  /**
   * Clear all highlights
   */
  private clearHighlights(): void {
    // Remove any existing highlight elements
    const highlights = document.querySelectorAll('.find-highlight')
    for (const highlight of highlights) {
      highlight.remove()
    }
  }

  /**
   * Save the original selection
   */
  private saveOriginalSelection(): void {
    this.originalSelection = globalThis.getSelection()
  }

  /**
   * Restore the original selection
   */
  private restoreOriginalSelection(): void {
    // Note: We can't actually restore the selection, but we can clear it
    const selection = globalThis.getSelection()
    if (selection) {
      selection.removeAllRanges()
    }
  }

  /**
   * Search for selected text
   */
  searchSelectedText(options: FindOptions = {}): FindResult {
    const selection = globalThis.getSelection()
    const selectedText = selection?.toString().trim()

    if (!selectedText) {
      return this.getCurrentResult()
    }

    return this.startFind(selectedText, options)
  }

  /**
   * Toggle case sensitivity
   */
  toggleCaseSensitive(): FindResult {
    this.currentOptions.caseSensitive = !this.currentOptions.caseSensitive
    this.performSearch()
    return this.getCurrentResult()
  }

  /**
   * Toggle whole word matching
   */
  toggleWholeWord(): FindResult {
    this.currentOptions.wholeWord = !this.currentOptions.wholeWord
    this.performSearch()
    return this.getCurrentResult()
  }

  /**
   * Toggle regex mode
   */
  toggleRegex(): FindResult {
    this.currentOptions.regex = !this.currentOptions.regex
    this.performSearch()
    return this.getCurrentResult()
  }
}

// Export singleton instance
export const findMode = new FindModeUtil()

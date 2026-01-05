import type { OptimizedCommand, TabResult } from "../../types/command-palette.types"
import { fuzzyMatch, commandScore, tabScore } from "../ranking.util"

const MAX_RESULTS = 50

export function filterCommands(
  commands: OptimizedCommand[],
  queryTerms: string[],
  query: string
): OptimizedCommand[] {
  if (!query.trim()) {
    return commands.slice(0, MAX_RESULTS)
  }

  return commands
    .filter((cmd) => {
      const searchableText = `${cmd._searchLabel} ${cmd._searchDesc} ${cmd._searchKeywords.join(" ")}`
      return fuzzyMatch(queryTerms, searchableText)
    })
    .map((cmd) => ({
      ...cmd,
      _score: commandScore(queryTerms, cmd.label, cmd.description, cmd.keywords)
    }))
    .sort((a, b) => (b._score ?? 0) - (a._score ?? 0))
    .slice(0, MAX_RESULTS)
}

export function filterTabs(
  tabs: TabResult[],
  queryTerms: string[],
  query: string
): TabResult[] {
  // Validate tabs have required properties with explicit type checks
  const validTabs = tabs.filter((tab) => {
    return (
      tab &&
      typeof tab.id === 'number' &&
      tab.id !== null &&
      tab.id !== undefined &&
      typeof tab.windowId === 'number' &&
      tab.windowId !== null &&
      tab.windowId !== undefined
    )
  })

  if (!query.trim()) {
    return validTabs.slice(0, MAX_RESULTS)
  }

  return validTabs
    .filter((tab) => {
      const searchableText = `${tab.title} ${tab.url}`
      return fuzzyMatch(queryTerms, searchableText)
    })
    .map((tab) => ({
      ...tab,
      _score: tabScore(queryTerms, tab.title, tab.url, tab.lastAccessed)
    }))
    .sort((a, b) => (b._score ?? 0) - (a._score ?? 0))
    .slice(0, MAX_RESULTS)
}


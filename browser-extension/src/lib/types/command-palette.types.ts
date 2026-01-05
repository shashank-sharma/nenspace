import type { Command } from "../config/commands"

export type SearchMode = "commands" | "tabs"

export interface TabResult {
  id: number
  title: string
  url: string
  favIconUrl?: string
  windowId: number
  lastAccessed?: number
  _score?: number
}

export interface OptimizedCommand extends Omit<Command, 'shortcut'> {
  shortcut?: string
  _searchLabel: string
  _searchDesc: string
  _searchKeywords: string[]
  _score?: number
}

export interface TimerCommand {
  duration: string
  label?: string
}


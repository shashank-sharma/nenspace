import type { OptimizedCommand } from "../../types/command-palette.types"
import { getAllCommands } from "../../config/commands"
import { formatShortcutDisplay, SHORTCUTS } from "../keyboard-shortcuts.util"

export function optimizeCommand(cmd: ReturnType<typeof getAllCommands>[0]): OptimizedCommand {
  const shortcutKey = cmd.id.toUpperCase().replace("-", "_") as keyof typeof SHORTCUTS
  const shortcutData = SHORTCUTS[shortcutKey]
  const shortcut = shortcutData ? formatShortcutDisplay(shortcutData) : undefined

  return {
    ...cmd,
    shortcut,
    _searchLabel: cmd.label.toLowerCase(),
    _searchDesc: cmd.description.toLowerCase(),
    _searchKeywords: cmd.keywords.map((k) => k.toLowerCase())
  }
}

export function optimizeCommands(): OptimizedCommand[] {
  return getAllCommands().map(optimizeCommand)
}


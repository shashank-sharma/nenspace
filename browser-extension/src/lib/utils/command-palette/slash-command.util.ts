import type { ComponentType } from "svelte"
import type { OptimizedCommand } from "../../types/command-palette.types"

export interface SlashCommandDefinition {
  id: string
  label: string
  description: string
  icon: ComponentType
  keywords: string[]
}

export function createSlashCommand(
  cmd: SlashCommandDefinition,
  prefix: string
): OptimizedCommand {
  return {
    id: `slash-${cmd.id}`,
    label: `${prefix}${cmd.label}`,
    description: cmd.description,
    icon: cmd.icon,
    action: () => {},
    keywords: cmd.keywords,
    _searchLabel: cmd.label,
    _searchDesc: cmd.description.toLowerCase(),
    _searchKeywords: cmd.keywords.map((k) => k.toLowerCase()),
    _score: 1000
  }
}

export function filterSlashCommands(
  commands: SlashCommandDefinition[],
  query: string
): SlashCommandDefinition[] {
  if (!query) {
    return commands
  }

  const lowerQuery = query.toLowerCase()
  return commands.filter((cmd) => {
    const searchable = `${cmd.label} ${cmd.keywords.join(" ")}`
    return searchable.toLowerCase().includes(lowerQuery)
  })
}


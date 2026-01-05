import type { TimerCommand } from "../../types/command-palette.types"
import { parseTime } from "../time-parser.util"

export function parseTimerCommand(query: string): TimerCommand | null {
  const trimmed = query.trim()
  const timerMatch = trimmed.match(/^\/timer\s+(.+)$/i)
  
  if (!timerMatch) {
    return null
  }

  const rest = timerMatch[1].trim()
  if (!rest) {
    return null
  }

  const parsed = parseTime(rest)
  if (parsed.isValid) {
    return { duration: rest }
  }

  const parts = rest.split(/\s+/)
  if (parts.length >= 2) {
    const durationStr = parts[0]
    const durationParsed = parseTime(durationStr)
    if (durationParsed.isValid) {
      const label = parts.slice(1).join(' ')
      return { duration: durationStr, label }
    }
  }

  return null
}

export function isTimerCommand(query: string): boolean {
  return /^\/timer\s*/i.test(query.trim())
}

export function extractTimerDuration(query: string): string {
  return query.trim().substring(6).trim()
}


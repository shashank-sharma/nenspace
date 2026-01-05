import type { Frontmatter } from '../types'

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/

export function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const match = content.match(FRONTMATTER_REGEX)

  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const frontmatterText = match[1]
  const body = match[2]

  try {
    const frontmatter = parseYAML(frontmatterText)
    return { frontmatter, body }
  } catch {
    return { frontmatter: {}, body: content }
  }
}

export function stringifyFrontmatter(frontmatter: Frontmatter, body: string): string {
  if (Object.keys(frontmatter).length === 0) {
    return body
  }

  const yaml = stringifyYAML(frontmatter)
  return `---\n${yaml}\n---\n${body}`
}

function parseYAML(text: string): Frontmatter {
  const result: Frontmatter = {}
  const lines = text.split('\n')

  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    let value = line.slice(colonIndex + 1).trim()

    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1)
      result[key] = value.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
    } else if (value.startsWith('"') && value.endsWith('"')) {
      result[key] = value.slice(1, -1)
    } else if (value === 'true') {
      result[key] = true
    } else if (value === 'false') {
      result[key] = false
    } else if (!isNaN(Number(value))) {
      result[key] = Number(value)
    } else {
      result[key] = value
    }
  }

  return result
}

function stringifyYAML(obj: Frontmatter): string {
  const lines: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map(v => `"${v}"`).join(', ')}]`)
    } else if (typeof value === 'string') {
      lines.push(`${key}: "${value}"`)
    } else {
      lines.push(`${key}: ${String(value)}`)
    }
  }

  return lines.join('\n')
}


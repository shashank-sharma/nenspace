import { nanoid } from 'nanoid'
import type { ParsedLink, LinkType, LinkPosition } from '../types'

export function parseLinks(content: string): ParsedLink[] {
  const links: ParsedLink[] = []
  const lines = content.split('\n')
  let absoluteOffset = 0

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]

    const wikiRegex = /(?<!!)\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g
    let match

    while ((match = wikiRegex.exec(line)) !== null) {
      const fullMatch = match[0]
      const target = match[1].trim()
      const anchor = match[2]?.trim() || null
      const displayText = match[3]?.trim() || null

      const isBlockRef = anchor?.startsWith('^')
      const blockRef = isBlockRef ? anchor.substring(1) : null
      const heading = !isBlockRef ? anchor : null

      links.push({
        id: nanoid(),
        type: 'wiki',
        target,
        targetNoteId: null,
        displayText,
        heading,
        blockRef,
        position: {
          line: lineIndex,
          start: match.index,
          end: match.index + fullMatch.length,
          startOffset: absoluteOffset + match.index,
          endOffset: absoluteOffset + match.index + fullMatch.length
        },
        resolved: false
      })
    }

    const embedRegex = /!\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g
    while ((match = embedRegex.exec(line)) !== null) {
      const fullMatch = match[0]
      const target = match[1].trim()
      const anchor = match[2]?.trim() || null
      const displayText = match[3]?.trim() || null

      const isBlockRef = anchor?.startsWith('^')
      const blockRef = isBlockRef ? anchor.substring(1) : null
      const heading = !isBlockRef ? anchor : null

      links.push({
        id: nanoid(),
        type: 'wiki-embed',
        target,
        targetNoteId: null,
        displayText,
        heading,
        blockRef,
        position: {
          line: lineIndex,
          start: match.index,
          end: match.index + fullMatch.length,
          startOffset: absoluteOffset + match.index,
          endOffset: absoluteOffset + match.index + fullMatch.length
        },
        resolved: false
      })
    }

    absoluteOffset += line.length + 1
  }

  return links
}

export function getLinkContext(content: string, position: LinkPosition, contextLength = 100): string {
  const start = Math.max(0, position.startOffset - contextLength)
  const end = Math.min(content.length, position.endOffset + contextLength)
  let context = content.slice(start, end)
  if (start > 0) context = '...' + context
  if (end < content.length) context = context + '...'
  return context.trim()
}

export function extractTags(content: string): string[] {
  const tags = new Set<string>()

  const inlineTagRegex = /#([a-zA-Z0-9_-]+)/g
  let match
  while ((match = inlineTagRegex.exec(content)) !== null) {
    tags.add(match[1])
  }

  return Array.from(tags)
}


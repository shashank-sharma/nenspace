import { nanoid } from 'nanoid'

const BLOCK_ID_REGEX = /\^([a-zA-Z0-9]+)/g
const BLOCK_REF_REGEX = /\[\[([^#\]]+)#\^([a-zA-Z0-9]+)\]\]/g

export interface BlockId {
  id: string
  lineNumber: number
  content: string
}

export function findBlockIds(content: string): Map<string, BlockId> {
  const blockIds = new Map<string, BlockId>()
  const lines = content.split('\n')

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    const match = line.match(BLOCK_ID_REGEX)

    if (match) {
      for (const idMatch of match) {
        const blockId = idMatch.substring(1)
        blockIds.set(blockId, {
          id: blockId,
          lineNumber: lineIndex,
          content: line
        })
      }
    }
  }

  return blockIds
}

export function generateBlockId(): string {
  return nanoid(6)
}

export function addBlockIdToLine(line: string, blockId?: string): string {
  const id = blockId || generateBlockId()

  if (line.includes(`^${id}`)) {
    return line
  }

  return `${line} ^${id}`
}

export function parseBlockReferences(content: string): Array<{ noteTarget: string; blockId: string; line: number }> {
  const references: Array<{ noteTarget: string; blockId: string; line: number }> = []
  const lines = content.split('\n')

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    const match = line.match(BLOCK_REF_REGEX)

    if (match) {
      for (const ref of match) {
        const fullMatch = ref.match(/\[\[([^#\]]+)#\^([a-zA-Z0-9]+)\]\]/)
        if (fullMatch) {
          references.push({
            noteTarget: fullMatch[1].trim(),
            blockId: fullMatch[2],
            line: lineIndex
          })
        }
      }
    }
  }

  return references
}


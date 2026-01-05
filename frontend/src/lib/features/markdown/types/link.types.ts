export type LinkType =
  | 'wiki'
  | 'wiki-embed'
  | 'heading'
  | 'block'

export interface LinkPosition {
  line: number
  start: number
  end: number
  startOffset: number
  endOffset: number
}

export interface ParsedLink {
  id: string
  type: LinkType
  target: string
  targetNoteId: string | null
  displayText: string | null
  heading: string | null
  blockRef: string | null
  position: LinkPosition
  resolved: boolean
}

export interface BackLink {
  sourceNoteId: string
  sourceNotePath: string
  sourceNoteTitle: string
  link: ParsedLink
  context: string
}

export interface BlockReference {
  noteTarget: string
  blockId: string
  lineNumber?: number
}


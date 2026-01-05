import { getStorageAdapter } from './storage'
import { parseLinks, getLinkContext } from '../utils'
import type { ParsedLink, BackLink, Note, NoteMetadata } from '../types'

export interface LinkIndex {
  outgoing: Map<string, ParsedLink[]>
  incoming: Map<string, BackLink[]>
  unresolved: Map<string, ParsedLink[]>
  tags: Map<string, Set<string>>
}

export class LinkIndexService {
  private vaultId: string
  private index: LinkIndex
  private _isBuilt = false
  private buildPromise: Promise<void> | null = null

  constructor(vaultId: string) {
    this.vaultId = vaultId
    this.index = {
      outgoing: new Map(),
      incoming: new Map(),
      unresolved: new Map(),
      tags: new Map()
    }
  }

  get isBuilt(): boolean {
    return this._isBuilt
  }

  async buildIndex(): Promise<void> {
    if (this._isBuilt) return

    if (this.buildPromise) {
      return this.buildPromise
    }

    this.buildPromise = this._doBuildIndex()

    try {
      await this.buildPromise
    } finally {
      this.buildPromise = null
    }
  }

  private async _doBuildIndex(): Promise<void> {
    const storage = await getStorageAdapter()
    const notes = await storage.listNotes(this.vaultId)

    this.index = {
      outgoing: new Map(),
      incoming: new Map(),
      unresolved: new Map(),
      tags: new Map()
    }

    const notePaths = new Set(notes.map(n => n.path))
    const notesByTitle = new Map(notes.map(n => [n.title.toLowerCase(), n.path]))
    const notesById = new Map(notes.map(n => [n.id, n]))

    for (const noteMeta of notes) {
      const note = await storage.readNote(this.vaultId, noteMeta.path)

      const links = parseLinks(note.content)

      const resolvedLinks = links.map((link: ParsedLink) => {
        const resolved = this.resolveLink(link.target, notePaths, notesByTitle)
        return {
          ...link,
          targetNoteId: resolved,
          resolved: resolved !== null
        }
      })

      this.index.outgoing.set(note.path, resolvedLinks)

      for (const link of resolvedLinks) {
        if (link.resolved && link.targetNoteId) {
          const existing = this.index.incoming.get(link.targetNoteId) || []
          const targetNote = notesById.get(link.targetNoteId)
          if (targetNote) {
            existing.push({
              sourceNoteId: note.id,
              sourceNotePath: note.path,
              sourceNoteTitle: note.title,
              link,
              context: getLinkContext(note.content, link.position)
            })
            this.index.incoming.set(link.targetNoteId, existing)
          }
        } else {
          const existing = this.index.unresolved.get(link.target) || []
          existing.push(link)
          this.index.unresolved.set(link.target, existing)
        }
      }

      for (const tag of note.tags) {
        const existing = this.index.tags.get(tag) || new Set()
        existing.add(note.id)
        this.index.tags.set(tag, existing)
      }
    }

    this._isBuilt = true
  }

  invalidate(): void {
    this._isBuilt = false
    this.index = {
      outgoing: new Map(),
      incoming: new Map(),
      unresolved: new Map(),
      tags: new Map()
    }
  }

  private resolveLink(target: string, notePaths: Set<string>, notesByTitle: Map<string, string>): string | null {
    const cleanTarget = target.split('#')[0].trim().toLowerCase()
    const asPath = cleanTarget.endsWith('.md') ? cleanTarget : `${cleanTarget}.md`

    if (notePaths.has(asPath)) return asPath

    if (notesByTitle.has(cleanTarget)) {
      return notesByTitle.get(cleanTarget)!
    }

    return null
  }

  getOutgoingLinks(notePath: string): ParsedLink[] {
    return this.index.outgoing.get(notePath) || []
  }

  getBacklinks(notePath: string): BackLink[] {
    return this.index.incoming.get(notePath) || []
  }

  getNotesByTag(tag: string): Set<string> {
    return this.index.tags.get(tag) || new Set()
  }

  getAllTags(): string[] {
    return Array.from(this.index.tags.keys())
  }

  getUnresolvedLinks(): Map<string, ParsedLink[]> {
    return this.index.unresolved
  }
}


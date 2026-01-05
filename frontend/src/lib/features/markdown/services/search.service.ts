import { getStorageAdapter } from './storage'
import type { NoteMetadata } from '../types'
import type { SearchQuery, SearchResult } from '../stores/search.store.svelte'

export class SearchService {
  async search(vaultId: string, query: SearchQuery, limit = 50): Promise<SearchResult[]> {
    const storage = await getStorageAdapter()

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const vault = await storage.openVault(vaultId)
      const indexPath = `${vault.path}/.vault/index.db`

      const results = await invoke<any[]>('markdown_search_notes', {
        indexPath,
        query: query.text || '',
        limit
      })

      return results.map((r: any) => ({
        note: {
          id: r.id,
          vaultId,
          title: r.title,
          path: r.path,
          created: new Date(r.created),
          updated: new Date(r.updated),
          tags: JSON.parse(r.tags || '[]'),
          aliases: JSON.parse(r.aliases || '[]'),
          linkCount: 0,
          backlinkCount: 0,
          wordCount: r.word_count || 0,
          isStarred: r.is_starred || false,
          isTemplate: r.is_template || false
        },
        score: r.score || 0,
        matches: r.snippet ? [{ type: 'content', text: r.snippet }] : []
      }))
    } catch {
      const notes = await storage.listNotes(vaultId)
      const filtered = this.filterNotes(notes, query)

      return filtered.slice(0, limit).map(note => ({
        note,
        score: 1,
        matches: []
      }))
    }
  }

  async quickSearch(vaultId: string, query: string, limit = 10): Promise<NoteMetadata[]> {
    const storage = await getStorageAdapter()
    const notes = await storage.listNotes(vaultId)

    if (!query) return notes.slice(0, limit)

    const lowerQuery = query.toLowerCase()

    return notes
      .filter(note =>
        note.title.toLowerCase().includes(lowerQuery) ||
        note.path.toLowerCase().includes(lowerQuery) ||
        note.aliases.some(a => a.toLowerCase().includes(lowerQuery))
      )
      .sort((a, b) => {
        const aTitleMatch = a.title.toLowerCase().startsWith(lowerQuery)
        const bTitleMatch = b.title.toLowerCase().startsWith(lowerQuery)
        if (aTitleMatch && !bTitleMatch) return -1
        if (!aTitleMatch && bTitleMatch) return 1
        return b.updated.getTime() - a.updated.getTime()
      })
      .slice(0, limit)
  }

  private filterNotes(notes: NoteMetadata[], query: SearchQuery): NoteMetadata[] {
    let filtered = notes

    if (query.text) {
      const lowerText = query.text.toLowerCase()
      filtered = filtered.filter(note =>
        note.title.toLowerCase().includes(lowerText) ||
        note.path.toLowerCase().includes(lowerText)
      )
    }

    if (query.filename) {
      const lowerFilename = query.filename.toLowerCase()
      filtered = filtered.filter(note =>
        note.path.toLowerCase().includes(lowerFilename)
      )
    }

    if (query.tags && query.tags.length > 0) {
      filtered = filtered.filter(note =>
        query.tags!.some(tag => note.tags.includes(tag))
      )
    }

    if (query.path) {
      filtered = filtered.filter(note =>
        note.path.startsWith(query.path!)
      )
    }

    return filtered
  }
}

export const searchService = new SearchService()


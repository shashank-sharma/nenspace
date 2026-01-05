import type { NoteMetadata } from '../types'

export interface SearchQuery {
  text?: string
  filename?: string
  tags?: string[]
  path?: string
  regex?: string
}

export interface SearchResult {
  note: NoteMetadata
  score: number
  matches: Array<{ type: string; text: string; line?: number }>
}

class SearchStore {
  query = $state<SearchQuery>({})
  results = $state<SearchResult[]>([])
  loading = $state(false)
  error = $state<string | null>(null)

  async quickSearch(query: string, limit = 10): Promise<NoteMetadata[]> {
    return []
  }

  setQuery(query: SearchQuery) {
    this.query = query
  }

  setResults(results: SearchResult[]) {
    this.results = results
  }

  reset() {
    this.query = {}
    this.results = []
    this.loading = false
    this.error = null
  }
}

export const searchStore = new SearchStore()


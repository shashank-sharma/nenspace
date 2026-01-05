import type { GraphData, GraphSettings } from '../types'
import { DEFAULT_GRAPH_SETTINGS } from '../types'

class GraphStore {
  data = $state<GraphData>({ nodes: [], edges: [] })
  settings = $state<GraphSettings>(DEFAULT_GRAPH_SETTINGS)
  loading = $state(false)
  error = $state<string | null>(null)
  currentNotePath = $state<string | null>(null)

  setData(data: GraphData) {
    this.data = data
  }

  setSettings(settings: Partial<GraphSettings>) {
    this.settings = { ...this.settings, ...settings }
  }

  setCurrentNote(path: string | null) {
    this.currentNotePath = path
  }

  reset() {
    this.data = { nodes: [], edges: [] }
    this.settings = DEFAULT_GRAPH_SETTINGS
    this.loading = false
    this.error = null
    this.currentNotePath = null
  }
}

export const graphStore = new GraphStore()


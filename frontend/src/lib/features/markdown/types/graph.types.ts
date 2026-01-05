import type { LinkType } from './link.types'

export interface GraphNode {
  id: string
  label: string
  path: string
  linkCount: number
  outgoingCount: number
  incomingCount: number
  group?: string
  isOrphan: boolean
  isCurrent: boolean
  x?: number
  y?: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: LinkType
  weight: number
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphSettings {
  showOrphans: boolean
  showAttachments: boolean
  colorBy: 'folder' | 'tag' | 'none'
  nodeSize: 'uniform' | 'connections'
  linkDistance: number
  chargeStrength: number
  centerStrength: number
}

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  showOrphans: true,
  showAttachments: false,
  colorBy: 'folder',
  nodeSize: 'connections',
  linkDistance: 100,
  chargeStrength: -300,
  centerStrength: 0.1
}


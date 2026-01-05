export interface Frontmatter {
  title?: string
  aliases?: string[]
  tags?: string[]
  created?: string
  updated?: string
  [key: string]: unknown
}

export type SyncStatus =
  | 'synced'
  | 'pending'
  | 'conflict'
  | 'local-only'
  | 'remote-only'

export interface Note {
  id: string
  vaultId: string
  title: string
  path: string
  content: string
  frontmatter: Frontmatter
  checksum: string
  created: Date
  updated: Date
  wordCount: number
  tags: string[]
  aliases: string[]
  syncStatus: SyncStatus
  remoteId: string | null
  remoteChecksum: string | null
  lastSynced: Date | null
  isStarred: boolean
  isTemplate: boolean
}

export interface NoteMetadata {
  id: string
  vaultId: string
  title: string
  path: string
  created: Date
  updated: Date
  tags: string[]
  aliases: string[]
  linkCount: number
  backlinkCount: number
  wordCount: number
  isStarred: boolean
  isTemplate: boolean
}

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileTreeNode[]
  metadata?: NoteMetadata
}

export interface FileChangeEvent {
  type: 'create' | 'modify' | 'delete' | 'rename'
  path: string
  oldPath?: string
}


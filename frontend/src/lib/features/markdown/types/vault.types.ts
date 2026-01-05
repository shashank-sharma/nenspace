export interface VaultSettings {
  defaultNoteLocation: string
  attachmentFolder: string
  dailyNoteFolder: string
  dailyNoteFormat: string
  dailyNoteTemplate: string | null
  templateFolder: string
  excludedFolders: string[]
  newLinkFormat: 'shortest' | 'relative' | 'absolute'
  useWikiLinks: boolean
  autoSave: boolean
  autoSaveInterval: number
}

export const DEFAULT_VAULT_SETTINGS: VaultSettings = {
  defaultNoteLocation: '',
  attachmentFolder: 'attachments',
  dailyNoteFolder: 'daily',
  dailyNoteFormat: 'YYYY-MM-DD',
  dailyNoteTemplate: null,
  templateFolder: 'templates',
  excludedFolders: ['.vault', '.trash', 'node_modules'],
  newLinkFormat: 'shortest',
  useWikiLinks: true,
  autoSave: true,
  autoSaveInterval: 5000
}

export interface Vault {
  id: string
  name: string
  path: string
  created: Date
  updated: Date
  settings: VaultSettings
  syncEnabled: boolean
  lastSynced: Date | null
  remoteId: string | null
  userId: string
}

export interface VaultMetadata {
  id: string
  name: string
  noteCount: number
  lastModified: Date
  syncEnabled: boolean
  lastSynced: Date | null
}


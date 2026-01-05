export interface SyncState {
  status: 'idle' | 'syncing' | 'error'
  lastSync: Date | null
  pendingChanges: number
  conflicts: ConflictRecord[]
  error: string | null
}

export interface ConflictRecord {
  id: string
  noteId: string
  localVersion: NoteVersion
  remoteVersion: NoteVersion
  detectedAt: Date
  resolved: boolean
  resolution?: ConflictResolution
}

export interface NoteVersion {
  content: string
  checksum: string
  updated: Date
}

export type ConflictResolution =
  | { type: 'keep-local' }
  | { type: 'keep-remote' }
  | { type: 'keep-both' }
  | { type: 'manual'; content: string }


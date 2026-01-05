import type { Vault, Note, NoteMetadata, FileTreeNode, FileChangeEvent } from '../../types'

export type Unsubscribe = () => void

export interface StorageAdapter {
  createVault(name: string, path?: string): Promise<Vault>
  openVault(id: string): Promise<Vault>
  listVaults(): Promise<Vault[]>
  deleteVault(id: string): Promise<void>
  updateVaultSettings(id: string, settings: Partial<Vault['settings']>): Promise<Vault>

  createNote(vaultId: string, path: string, content: string): Promise<Note>
  readNote(vaultId: string, path: string): Promise<Note>
  updateNote(vaultId: string, path: string, content: string): Promise<Note>
  deleteNote(vaultId: string, path: string): Promise<void>
  moveNote(vaultId: string, from: string, to: string): Promise<Note>
  listNotes(vaultId: string, folder?: string): Promise<NoteMetadata[]>

  createFolder(vaultId: string, path: string): Promise<void>
  deleteFolder(vaultId: string, path: string): Promise<void>

  getFileTree(vaultId: string): Promise<FileTreeNode>

  watchVault?(vaultId: string, callback: (event: FileChangeEvent) => void): Promise<Unsubscribe>
}


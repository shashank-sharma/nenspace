import PocketBase from 'pocketbase'
import { getStorageAdapter } from './storage'
import { calculateChecksum } from '../utils'
import { nanoid } from 'nanoid'
import type { Vault, Note, SyncState, ConflictRecord, ConflictResolution, NoteVersion } from '../types'

export class SyncEngine {
  private pb: PocketBase
  private deviceId: string

  constructor(pocketbaseUrl: string) {
    this.pb = new PocketBase(pocketbaseUrl)
    this.deviceId = typeof window !== 'undefined'
      ? localStorage.getItem('markdown_deviceId') || (() => {
          const id = nanoid()
          localStorage.setItem('markdown_deviceId', id)
          return id
        })()
      : nanoid()
  }

  async authenticate(email: string, password: string): Promise<void> {
    await this.pb.collection('users').authWithPassword(email, password)
  }

  async syncVault(vault: Vault): Promise<SyncState> {
    if (!vault.syncEnabled || !vault.remoteId) {
      return {
        status: 'idle',
        lastSync: vault.lastSynced,
        pendingChanges: 0,
        conflicts: [],
        error: null
      }
    }

    const conflicts: ConflictRecord[] = []

    try {
      const storage = await getStorageAdapter()
      const localNotes = await storage.listNotes(vault.id)
      const localNotesMap = new Map<string, Note>()

      for (const meta of localNotes) {
        const note = await storage.readNote(vault.id, meta.path)
        localNotesMap.set(note.path, note)
      }

      const remoteNotes = await this.pb.collection('notes').getFullList({
        filter: `vault = "${vault.remoteId}"`
      })

      const remoteNotesMap = new Map(remoteNotes.map((n: any) => [n.path, n]))
      const allPaths = new Set([...localNotesMap.keys(), ...remoteNotesMap.keys()])

      for (const path of allPaths) {
        const local = localNotesMap.get(path)
        const remote = remoteNotesMap.get(path)

        if (local && remote) {
          const conflict = await this.handleBothExist(vault, local, remote, storage)
          if (conflict) conflicts.push(conflict)
        } else if (local && !remote) {
          await this.uploadNote(vault, local)
        } else if (!local && remote) {
          await this.downloadNote(vault, remote, storage)
        }
      }

      return {
        status: 'idle',
        lastSync: new Date(),
        pendingChanges: 0,
        conflicts,
        error: null
      }
    } catch (error) {
      return {
        status: 'error',
        lastSync: vault.lastSynced,
        pendingChanges: 0,
        conflicts,
        error: error instanceof Error ? error.message : 'Sync failed'
      }
    }
  }

  private async handleBothExist(
    vault: Vault,
    local: Note,
    remote: any,
    storage: Awaited<ReturnType<typeof getStorageAdapter>>
  ): Promise<ConflictRecord | null> {
    const localChecksum = await calculateChecksum(local.content)

    if (localChecksum === remote.checksum) return null

    if (local.remoteChecksum === remote.checksum) {
      await this.uploadNote(vault, local)
      return null
    }

    if (localChecksum === local.remoteChecksum) {
      await this.downloadNote(vault, remote, storage)
      return null
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const conflictPath = local.path.replace(/\.md$/, ` (conflict ${timestamp}).md`)
    await storage.createNote(vault.id, conflictPath, remote.content)

    return {
      id: nanoid(),
      noteId: local.id,
      localVersion: {
        content: local.content,
        checksum: localChecksum,
        updated: local.updated
      },
      remoteVersion: {
        content: remote.content,
        checksum: remote.checksum,
        updated: new Date(remote.updated)
      },
      detectedAt: new Date(),
      resolved: false
    }
  }

  private async uploadNote(vault: Vault, note: Note): Promise<void> {
    const checksum = await calculateChecksum(note.content)

    if (note.remoteId) {
      await this.pb.collection('notes').update(note.remoteId, {
        content: note.content,
        title: note.title,
        frontmatter: note.frontmatter,
        checksum,
        tags: note.tags,
        aliases: note.aliases
      })
    } else {
      const record = await this.pb.collection('notes').create({
        vault: vault.remoteId,
        path: note.path,
        title: note.title,
        content: note.content,
        frontmatter: note.frontmatter,
        checksum,
        tags: note.tags,
        aliases: note.aliases
      })
      note.remoteId = record.id
    }

    note.remoteChecksum = checksum
    note.lastSynced = new Date()
    note.syncStatus = 'synced'
  }

  private async downloadNote(
    vault: Vault,
    remote: any,
    storage: Awaited<ReturnType<typeof getStorageAdapter>>
  ): Promise<void> {
    const notes = await storage.listNotes(vault.id)
    const exists = notes.some(n => n.path === remote.path)

    if (exists) {
      await storage.updateNote(vault.id, remote.path, remote.content)
    } else {
      await storage.createNote(vault.id, remote.path, remote.content)
    }
  }

  async enableSync(vault: Vault): Promise<void> {
    const userId = this.pb.authStore.model?.id
    if (!userId) throw new Error('Not authenticated')

    const record = await this.pb.collection('vaults').create({
      name: vault.name,
      user: userId,
      settings: vault.settings
    })

    vault.remoteId = record.id
    vault.syncEnabled = true
    await this.syncVault(vault)
  }

  async resolveConflict(
    conflictId: string,
    resolution: ConflictResolution,
    vault: Vault,
    noteId: string
  ): Promise<void> {
    const storage = await getStorageAdapter()
    const note = await storage.readNote(vault.id, noteId)

    switch (resolution.type) {
      case 'keep-local':
        await this.uploadNote(vault, note)
        break
      case 'keep-remote':
        const remote = await this.pb.collection('notes').getOne(note.remoteId!)
        await storage.updateNote(vault.id, note.path, remote.content)
        break
      case 'keep-both':
        break
      case 'manual':
        await storage.updateNote(vault.id, note.path, resolution.content)
        await this.uploadNote(vault, note)
        break
    }
  }
}


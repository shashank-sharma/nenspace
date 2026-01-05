import { getStorageAdapter } from '../services/storage'
import type { Note, NoteMetadata } from '../types'
import { pb } from '$lib/config/pocketbase'
import type { UnsubscribeFunc } from 'pocketbase'
import { parseFrontmatter, stringifyFrontmatter } from '../utils'
import {
  isAutoCancelledError,
  extractErrorMessage
} from '../utils/error-handler'
import {
  recordToNoteMetadata,
  createNoteMetadata
} from '../utils/note-converter'

class NotesStore {
  notes = $state<NoteMetadata[]>([])
  activeNote = $state<Note | null>(null)
  loading = $state(false)
  error = $state<string | null>(null)
  private loadNotesPromise: Map<string, Promise<NoteMetadata[]>> = new Map()
  private notesSubscription: UnsubscribeFunc | null = null
  private activeNoteSubscription: UnsubscribeFunc | null = null
  private currentVaultId: string | null = null
  private hasInitializedVault: Set<string> = new Set()
  private isSubscribing: boolean = false

  get activeVaultId() {
    return this.activeNote?.vaultId || null
  }

  async loadNotes(vaultId: string, folder?: string, forceRefresh: boolean = false) {
    const key = `${vaultId}:${folder || ''}`

    if (!forceRefresh && this.loadNotesPromise.has(key)) {
      return this.loadNotesPromise.get(key)!
    }

    const promise = this._doLoadNotes(vaultId, folder, forceRefresh)
    this.loadNotesPromise.set(key, promise)

    try {
      const result = await promise
      return result
    } finally {
      this.loadNotesPromise.delete(key)
    }
  }

  private async _doLoadNotes(vaultId: string, folder?: string, forceRefresh: boolean = false) {
    if (vaultId !== this.currentVaultId) {
      await this.setupRealtimeSubscriptions(vaultId)
    }

    const storage = await getStorageAdapter()
    if (storage.constructor.name === 'TauriStorageAdapter') {
      this.loading = true
      this.error = null

      try {
        const notes = await storage.listNotes(vaultId, folder)
        this.notes = notes
        return notes
      } catch (err) {
        this.error = extractErrorMessage(err)
        return []
      } finally {
        this.loading = false
      }
    }

    if (
      !forceRefresh &&
      this.hasInitializedVault.has(vaultId) &&
      this.notes.length > 0
    ) {
      return this.notes.filter(n => !folder || n.path.startsWith(folder))
    }

    this.loading = true
    this.error = null

    try {
      const notes = await storage.listNotes(vaultId, folder)
      this.notes = notes
      this.hasInitializedVault.add(vaultId)
      return notes
    } catch (err) {
      if (isAutoCancelledError(err)) {
        if (this.notes.length > 0) {
          return this.notes.filter(n => !folder || n.path.startsWith(folder))
        }
        this.error = null
        return []
      }

      this.error = extractErrorMessage(err)
      return []
    } finally {
      this.loading = false
    }
  }

  private async setupRealtimeSubscriptions(vaultId: string) {
    if (this.isSubscribing || this.currentVaultId === vaultId) {
      return
    }

    this.cleanupSubscriptions()
    this.currentVaultId = vaultId
    this.isSubscribing = true

    if (typeof window === 'undefined') {
      this.isSubscribing = false
      return
    }

    const storage = await getStorageAdapter()
    if (storage.constructor.name === 'TauriStorageAdapter') {
      this.isSubscribing = false
      return
    }

    try {
      const unsub = await pb
        .collection('notes')
        .subscribe('*', (e: { action: string; record: any }) => {
          if (e.record.vault !== vaultId) return

          if (e.action === 'create') {
            this.handleNoteCreated(e.record)
          } else if (e.action === 'update') {
            this.handleNoteUpdated(e.record)
          } else if (e.action === 'delete') {
            this.handleNoteDeleted(e.record.id)
          }
        })

      this.notesSubscription = unsub
    } catch {
    } finally {
      this.isSubscribing = false
    }
  }

  private handleNoteCreated(record: any) {
    const metadata = recordToNoteMetadata(record, record.vault)

    if (!this.notes.find(n => n.id === record.id)) {
      this.notes = [...this.notes, metadata]
    }
  }

  private handleNoteUpdated(record: any) {
    const index = this.notes.findIndex(n => n.id === record.id)
    if (index >= 0) {
      const metadata = recordToNoteMetadata(
        record,
        record.vault,
        this.notes[index]
      )
      this.notes[index] = metadata
    }

    if (this.activeNote?.id === record.id) {
      const { frontmatter, body } = parseFrontmatter(record.content || '')
      const fullContent = stringifyFrontmatter(frontmatter, body)

      this.activeNote = {
        ...this.activeNote,
        title: record.title,
        content: fullContent,
        frontmatter,
        updated: new Date(record.updated),
        tags: record.tags || [],
        aliases: record.aliases || [],
        wordCount: record.word_count || 0,
        isStarred: record.is_starred || false,
        isTemplate: record.is_template || false
      }
    }
  }

  private handleNoteDeleted(noteId: string) {
    this.notes = this.notes.filter(n => n.id !== noteId)

    if (this.activeNote?.id === noteId) {
      this.activeNote = null
      this.cleanupActiveNoteSubscription()
    }
  }

  async subscribeToActiveNote(noteId: string) {
    this.cleanupActiveNoteSubscription()

    if (typeof window === 'undefined') return

    try {
      const { getTauriVersion } = await import('@tauri-apps/api/app')
      await getTauriVersion()
      return
    } catch {
    }

    pb.collection('notes')
      .subscribe(noteId, (e: { action: string; record: any }) => {
        if (e.action === 'update' && this.activeNote?.id === noteId) {
          const { frontmatter, body } = parseFrontmatter(e.record.content || '')
          const fullContent = stringifyFrontmatter(frontmatter, body)

          this.activeNote = {
            ...this.activeNote,
            title: e.record.title,
            content: fullContent,
            frontmatter,
            updated: new Date(e.record.updated),
            tags: e.record.tags || [],
            aliases: e.record.aliases || [],
            wordCount: e.record.word_count || 0,
            isStarred: e.record.is_starred || false,
            isTemplate: e.record.is_template || false
          }
        } else if (e.action === 'delete') {
          this.activeNote = null
          this.cleanupActiveNoteSubscription()
        }
      })
      .then((unsub) => {
        this.activeNoteSubscription = unsub
      })
      .catch(() => {
      })
  }

  private cleanupActiveNoteSubscription() {
    if (this.activeNoteSubscription) {
      this.activeNoteSubscription()
      this.activeNoteSubscription = null
    }
  }

  private cleanupSubscriptions() {
    if (this.notesSubscription) {
      this.notesSubscription()
      this.notesSubscription = null
    }
    this.cleanupActiveNoteSubscription()
  }

  async loadNote(vaultId: string, path: string) {
    this.loading = true
    this.error = null

    try {
      const storage = await getStorageAdapter()
      const note = await storage.readNote(vaultId, path)
      this.activeNote = note

      if (note.remoteId) {
        this.subscribeToActiveNote(note.remoteId)
      }

      return note
    } catch (err) {
      this.error = extractErrorMessage(err)
      throw err
    } finally {
      this.loading = false
    }
  }

  async createNote(vaultId: string, path: string, content: string) {
    this.loading = true
    this.error = null

    try {
      const storage = await getStorageAdapter()
      const note = await storage.createNote(vaultId, path, content)

      this.activeNote = note

      const metadata = createNoteMetadata(note)

      if (!this.notes.find(n => n.id === note.id)) {
        this.notes = [...this.notes, metadata]
      }

      return note
    } catch (err) {
      this.error = extractErrorMessage(err)
      throw err
    } finally {
      this.loading = false
    }
  }

  async updateNote(vaultId: string, path: string, content: string) {
    this.loading = true
    this.error = null

    try {
      const storage = await getStorageAdapter()
      const note = await storage.updateNote(vaultId, path, content)

      const index = this.notes.findIndex(n => n.path === path)
      if (index >= 0) {
        const metadata = createNoteMetadata(note)
        this.notes[index] = metadata
      }

      if (this.activeNote?.path === path) {
        this.activeNote = note
      }

      return note
    } catch (err) {
      this.error = extractErrorMessage(err)
      throw err
    } finally {
      this.loading = false
    }
  }

  async deleteNote(vaultId: string, path: string) {
    this.loading = true
    this.error = null

    try {
      const storage = await getStorageAdapter()
      await storage.deleteNote(vaultId, path)

      this.notes = this.notes.filter(n => n.path !== path)

      if (this.activeNote?.path === path) {
        this.activeNote = null
      }
    } catch (err) {
      this.error = extractErrorMessage(err)
      throw err
    } finally {
      this.loading = false
    }
  }

  async moveNote(vaultId: string, from: string, to: string) {
    this.loading = true
    this.error = null

    try {
      const storage = await getStorageAdapter()
      const note = await storage.moveNote(vaultId, from, to)

      const index = this.notes.findIndex(n => n.path === from)
      if (index >= 0) {
        const metadata = createNoteMetadata(note)
        metadata.linkCount = this.notes[index].linkCount
        metadata.backlinkCount = this.notes[index].backlinkCount
        this.notes[index] = metadata
      }

      if (this.activeNote?.path === from) {
        this.activeNote = note
      }

      return note
    } catch (err) {
      this.error = extractErrorMessage(err)
      throw err
    } finally {
      this.loading = false
    }
  }

  setActiveNote(note: Note | null) {
    this.activeNote = note
  }

  reset() {
    this.notes = []
    this.activeNote = null
    this.loading = false
    this.error = null
    this.cleanupSubscriptions()
    this.currentVaultId = null
    this.loadNotesPromise.clear()
    this.hasInitializedVault.clear()
    this.isSubscribing = false
  }
}

export const notesStore = new NotesStore()


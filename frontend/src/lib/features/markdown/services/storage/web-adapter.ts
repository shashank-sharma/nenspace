import type PocketBase from 'pocketbase'
import { nanoid } from 'nanoid'
import type { StorageAdapter } from './storage.interface'
import type {
  Vault,
  Note,
  NoteMetadata,
  FileTreeNode,
  FileChangeEvent,
  VaultSettings
} from '../../types'
import { DEFAULT_VAULT_SETTINGS } from '../../types'
import {
  calculateChecksum,
  parseFrontmatter,
  parseLinks,
  extractTags,
  joinPath,
  normalizePath,
  basename
} from '../../utils'
import { recordToNote, recordToNoteMetadata } from '../../utils/note-converter'

export class WebStorageAdapter implements StorageAdapter {
  private pb: PocketBase

  constructor(pocketbase: PocketBase) {
    this.pb = pocketbase
  }

  async createVault(name: string, path?: string): Promise<Vault> {
    const userId = this.pb.authStore.model?.id
    if (!userId) throw new Error('Not authenticated')

    const vaultData = {
      user: userId,
      name,
      settings: DEFAULT_VAULT_SETTINGS,
      last_synced: null
    }

    const record = await this.pb.collection('vaults').create(vaultData)

    return {
      id: record.id,
      name: record.name,
      path: path || '',
      created: new Date(record.created),
      updated: new Date(record.updated),
      settings: record.settings as VaultSettings,
      syncEnabled: true,
      lastSynced: record.last_synced ? new Date(record.last_synced) : null,
      remoteId: record.id,
      userId
    }
  }

  async openVault(id: string): Promise<Vault> {
    const record = await this.pb.collection('vaults').getOne(id)

    return {
      id: record.id,
      name: record.name,
      path: '',
      created: new Date(record.created),
      updated: new Date(record.updated),
      settings: record.settings as VaultSettings,
      syncEnabled: true,
      lastSynced: record.last_synced ? new Date(record.last_synced) : null,
      remoteId: record.id,
      userId: record.user
    }
  }

  async listVaults(): Promise<Vault[]> {
    const userId = this.pb.authStore.model?.id
    if (!userId) return []

    const records = await this.pb.collection('vaults').getFullList({
      filter: `user = "${userId}"`
    })

    return records.map(record => ({
      id: record.id,
      name: record.name,
      path: '',
      created: new Date(record.created),
      updated: new Date(record.updated),
      settings: record.settings as VaultSettings,
      syncEnabled: true,
      lastSynced: record.last_synced ? new Date(record.last_synced) : null,
      remoteId: record.id,
      userId: record.user
    }))
  }

  async deleteVault(id: string): Promise<void> {
    await this.pb.collection('vaults').delete(id)
  }

  async updateVaultSettings(id: string, settings: Partial<Vault['settings']>): Promise<Vault> {
    const record = await this.pb.collection('vaults').getOne(id)
    const updatedSettings = { ...record.settings, ...settings }

    const updated = await this.pb.collection('vaults').update(id, {
      settings: updatedSettings
    })

    return {
      id: updated.id,
      name: updated.name,
      path: '',
      created: new Date(updated.created),
      updated: new Date(updated.updated),
      settings: updated.settings as VaultSettings,
      syncEnabled: true,
      lastSynced: updated.last_synced ? new Date(updated.last_synced) : null,
      remoteId: updated.id,
      userId: updated.user
    }
  }

  async createNote(vaultId: string, path: string, content: string): Promise<Note> {
    const userId = this.pb.authStore.model?.id
    if (!userId) throw new Error('Not authenticated')

    const { frontmatter, body } = parseFrontmatter(content)
    const checksum = await calculateChecksum(content)
    const tags = extractTags(content)
    const title = frontmatter.title || basename(path).replace(/\.md$/, '')
    const wordCount = body.split(/\s+/).filter(Boolean).length
    const links = parseLinks(content)

    const noteData = {
      user: userId,
      vault: vaultId,
      path: normalizePath(path),
      title,
      content: body,
      frontmatter,
      checksum,
      tags,
      aliases: frontmatter.aliases || [],
      word_count: wordCount,
      local_id: nanoid(),
      is_starred: false,
      is_template: false
    }

    const record = await this.pb.collection('notes').create(noteData)

    await this.updateNoteLinks(vaultId, record.id, path, links)

    return recordToNote(record, vaultId)
  }

  async readNote(vaultId: string, path: string): Promise<Note> {
    const records = await this.pb.collection('notes').getFullList({
      filter: `vault = "${vaultId}" && path = "${normalizePath(path)}"`,
      limit: 1
    })

    if (records.length === 0) {
      throw new Error(`Note not found: ${path}`)
    }

    return recordToNote(records[0], vaultId)
  }

  async updateNote(vaultId: string, path: string, content: string): Promise<Note> {
    const records = await this.pb.collection('notes').getFullList({
      filter: `vault = "${vaultId}" && path = "${normalizePath(path)}"`,
      limit: 1
    })

    if (records.length === 0) {
      return this.createNote(vaultId, path, content)
    }

    const existing = records[0]
    const { frontmatter, body } = parseFrontmatter(content)
    const checksum = await calculateChecksum(content)
    const links = parseLinks(content)
    const tags = extractTags(content)
    const title = frontmatter.title || basename(path).replace(/\.md$/, '')
    const wordCount = body.split(/\s+/).filter(Boolean).length

    const updated = await this.pb.collection('notes').update(existing.id, {
      title,
      content: body,
      frontmatter,
      checksum,
      tags,
      aliases: frontmatter.aliases || [],
      word_count: wordCount
    })

    await this.updateNoteLinks(vaultId, updated.id, path, links)

    return recordToNote(updated, vaultId)
  }

  async deleteNote(vaultId: string, path: string): Promise<void> {
    const records = await this.pb.collection('notes').getFullList({
      filter: `vault = "${vaultId}" && path = "${normalizePath(path)}"`,
      limit: 1
    })

    if (records.length > 0) {
      await this.pb.collection('notes').delete(records[0].id)
      await this.pb.collection('note_links').getFullList({
        filter: `source_note = "${records[0].id}" || target_note = "${records[0].id}"`
      }).then(links => {
        return Promise.all(links.map(link => this.pb.collection('note_links').delete(link.id)))
      })
    }
  }

  async moveNote(vaultId: string, from: string, to: string): Promise<Note> {
    const note = await this.readNote(vaultId, from)
    const updated = await this.pb.collection('notes').update(note.remoteId!, {
      path: normalizePath(to)
    })

    await this.deleteNote(vaultId, from)

    return recordToNote(updated, vaultId)
  }

  async listNotes(vaultId: string, folder?: string): Promise<NoteMetadata[]> {
    let filter = `vault = "${vaultId}"`
    if (folder) {
      filter += ` && path ~ "${normalizePath(folder)}"`
    }

    const records = await this.pb.collection('notes').getFullList({
      filter,
      sort: '-updated'
    })

    const links = await this.pb.collection('note_links').getFullList({
      filter: `vault = "${vaultId}"`
    })

      const linkCounts = new Map<string, { outgoing: number; incoming: number }>()

      for (const link of links) {
        const sourceId =
          typeof link.source_note === 'string'
            ? link.source_note
            : (link.source_note as any)?.id || link.source_note
        if (sourceId) {
          const counts = linkCounts.get(sourceId) || { outgoing: 0, incoming: 0 }
          counts.outgoing++
          linkCounts.set(sourceId, counts)
        }
        if (link.target_note) {
          const targetId =
            typeof link.target_note === 'string'
              ? link.target_note
              : (link.target_note as any)?.id || link.target_note
          if (targetId) {
            const counts = linkCounts.get(targetId) || { outgoing: 0, incoming: 0 }
            counts.incoming++
            linkCounts.set(targetId, counts)
          }
        }
      }

    return records.map(record => {
      const counts = linkCounts.get(record.id) || { outgoing: 0, incoming: 0 }
      const metadata = recordToNoteMetadata(record, vaultId)
      return {
        ...metadata,
        linkCount: counts.outgoing + counts.incoming,
        backlinkCount: counts.incoming
      }
    })
  }

  async createFolder(vaultId: string, path: string): Promise<void> {
  }

  async deleteFolder(vaultId: string, path: string): Promise<void> {
    const notes = await this.listNotes(vaultId, path)
    await Promise.all(notes.map(note => this.deleteNote(vaultId, note.path)))
  }

  async getFileTree(vaultId: string): Promise<FileTreeNode> {
    const notes = await this.listNotes(vaultId)
    const tree: FileTreeNode = {
      name: 'root',
      path: '',
      type: 'folder',
      children: []
    }

    const pathMap = new Map<string, FileTreeNode>()
    pathMap.set('', tree)

    for (const note of notes) {
      const parts = note.path.split('/').filter(Boolean)
      let currentPath = ''

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const parentPath = currentPath
        currentPath = joinPath(currentPath, part)

        if (!pathMap.has(currentPath)) {
          const isFile = i === parts.length - 1 && note.path.endsWith('.md')
          const node: FileTreeNode = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : [],
            metadata: isFile ? note : undefined
          }

          pathMap.set(currentPath, node)
          const parent = pathMap.get(parentPath)
          if (parent && parent.children) {
            parent.children.push(node)
          }
        }
      }
    }

    return tree
  }

  private async updateNoteLinks(
    vaultId: string,
    noteId: string,
    notePath: string,
    links: ReturnType<typeof parseLinks>
  ): Promise<void> {
    const userId = this.pb.authStore.model?.id
    if (!userId) return

    const existingLinks = await this.pb.collection('note_links').getFullList({
      filter: `source_note = "${noteId}"`
    })

    await Promise.all(existingLinks.map(link => this.pb.collection('note_links').delete(link.id)))

    const notesRecords = await this.pb.collection('notes').getFullList({
      filter: `vault = "${vaultId}"`
    })

    const notesByPath = new Map(notesRecords.map((n: any) => [n.path, n]))
    const notesByTitle = new Map(notesRecords.map((n: any) => [n.title.toLowerCase(), n]))

    for (const link of links) {
      let targetNoteId: string | null = null
      const targetPath = link.target.split('#')[0].trim()
      const normalizedTarget = normalizePath(
        targetPath.endsWith('.md') ? targetPath : `${targetPath}.md`
      )

      if (notesByPath.has(normalizedTarget)) {
        targetNoteId = notesByPath.get(normalizedTarget)!.id
      } else if (notesByTitle.has(targetPath.toLowerCase())) {
        targetNoteId = notesByTitle.get(targetPath.toLowerCase())!.id
      }

      await this.pb.collection('note_links').create({
        user: userId,
        vault: vaultId,
        source_note: noteId,
        target_note: targetNoteId,
        target_path: link.target,
        link_type:
          link.type === 'wiki'
            ? 'wiki'
            : link.type === 'wiki-embed'
              ? 'wiki-embed'
              : link.blockRef
                ? 'block'
                : 'heading',
        display_text: link.displayText,
        heading: link.heading,
        block_ref: link.blockRef,
        position_line: link.position.line,
        position_start: link.position.start,
        position_end: link.position.end
      })
    }
  }

}


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
  extractTags,
  joinPath,
  normalizePath,
  dirname,
  basename
} from '../../utils'
import { contentToNote, recordToNoteMetadata } from '../../utils/note-converter'

export class TauriStorageAdapter implements StorageAdapter {
  private watchers = new Map<string, () => void>()

  async createVault(name: string, path?: string): Promise<Vault> {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { createDir, writeTextFile, exists } = await import(
      '@tauri-apps/plugin-fs'
    )

    let vaultPath = path

    if (!vaultPath) {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Vault Location'
      })

      if (!selected || Array.isArray(selected)) {
        throw new Error('No vault path selected')
      }

      vaultPath = selected
    }

    const vaultDir = vaultPath
    const vaultConfigDir = joinPath(vaultDir, '.vault')

    if (!(await exists(vaultConfigDir))) {
      await createDir(vaultConfigDir)
    }

    const configPath = joinPath(vaultConfigDir, 'config.json')
    const config = {
      name,
      settings: DEFAULT_VAULT_SETTINGS,
      created: new Date().toISOString()
    }

    await writeTextFile(configPath, JSON.stringify(config, null, 2))

    const indexPath = joinPath(vaultConfigDir, 'index.db')
    await this.initializeIndex(indexPath)

    return {
      id: nanoid(),
      name,
      path: vaultDir,
      created: new Date(),
      updated: new Date(),
      settings: DEFAULT_VAULT_SETTINGS,
      syncEnabled: false,
      lastSynced: null,
      remoteId: null,
      userId: ''
    }
  }

  async openVault(id: string): Promise<Vault> {
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const { BaseDirectory } = await import('@tauri-apps/plugin-fs')

    const configPath = joinPath(id, '.vault', 'config.json')
    const configText = await readTextFile(configPath)
    const config = JSON.parse(configText)

    return {
      id,
      name: config.name,
      path: id,
      created: new Date(config.created),
      updated: new Date(),
      settings: config.settings || DEFAULT_VAULT_SETTINGS,
      syncEnabled: false,
      lastSynced: null,
      remoteId: null,
      userId: ''
    }
  }

  async listVaults(): Promise<Vault[]> {
    return []
  }

  async deleteVault(id: string): Promise<void> {
    const { removeDir } = await import('@tauri-apps/plugin-fs')
    await removeDir(id, { recursive: true })
  }

  async updateVaultSettings(id: string, settings: Partial<Vault['settings']>): Promise<Vault> {
    const { readTextFile, writeTextFile } = await import('@tauri-apps/plugin-fs')
    const configPath = joinPath(id, '.vault', 'config.json')
    const configText = await readTextFile(configPath)
    const config = JSON.parse(configText)

    config.settings = { ...config.settings, ...settings }
    await writeTextFile(configPath, JSON.stringify(config, null, 2))

    return {
      id,
      name: config.name,
      path: id,
      created: new Date(config.created),
      updated: new Date(),
      settings: config.settings,
      syncEnabled: false,
      lastSynced: null,
      remoteId: null,
      userId: ''
    }
  }

  async createNote(vaultId: string, path: string, content: string): Promise<Note> {
    const { writeTextFile, createDir } = await import('@tauri-apps/plugin-fs')
    const fullPath = joinPath(vaultId, normalizePath(path))
    const dir = dirname(fullPath)

    if (dir && dir !== vaultId) {
      await createDir(dir, { recursive: true })
    }

    await writeTextFile(fullPath, content)
    await this.indexNote(vaultId, path, content)

    return contentToNote(vaultId, path, content, nanoid())
  }

  async readNote(vaultId: string, path: string): Promise<Note> {
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const fullPath = joinPath(vaultId, normalizePath(path))
    const content = await readTextFile(fullPath)
    return contentToNote(vaultId, path, content, nanoid())
  }

  async updateNote(vaultId: string, path: string, content: string): Promise<Note> {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const fullPath = joinPath(vaultId, normalizePath(path))
    await writeTextFile(fullPath, content)
    await this.indexNote(vaultId, path, content)
    return contentToNote(vaultId, path, content, nanoid())
  }

  async deleteNote(vaultId: string, path: string): Promise<void> {
    const { removeFile } = await import('@tauri-apps/plugin-fs')
    const fullPath = joinPath(vaultId, normalizePath(path))
    await removeFile(fullPath)
    await this.removeFromIndex(vaultId, path)
  }

  async moveNote(vaultId: string, from: string, to: string): Promise<Note> {
    const { rename } = await import('@tauri-apps/plugin-fs')
    const fromPath = joinPath(vaultId, normalizePath(from))
    const toPath = joinPath(vaultId, normalizePath(to))
    await rename(fromPath, toPath)

    const note = await this.readNote(vaultId, to)
    await this.removeFromIndex(vaultId, from)
    await this.indexNote(vaultId, to, note.content)

    return note
  }

  async listNotes(vaultId: string, folder?: string): Promise<NoteMetadata[]> {
    const { invoke } = await import('@tauri-apps/api/core')
    const indexPath = joinPath(vaultId, '.vault', 'index.db')

    let filter = ''
    if (folder) {
      filter = `WHERE path LIKE '${normalizePath(folder)}%'`
    }

    const results = await invoke<any[]>('markdown_list_notes', {
      indexPath,
      filter
    })

    return results.map(r => {
      const record = {
        id: r.id,
        vault: vaultId,
        title: r.title,
        path: r.path,
        created: r.created,
        updated: r.updated,
        tags: JSON.parse(r.tags || '[]'),
        aliases: JSON.parse(r.aliases || '[]'),
        word_count: r.word_count || 0,
        is_starred: r.is_starred || false,
        is_template: r.is_template || false
      }
      const metadata = recordToNoteMetadata(record, vaultId)
      return {
        ...metadata,
        linkCount: r.link_count || 0,
        backlinkCount: r.backlink_count || 0
      }
    })
  }

  async createFolder(vaultId: string, path: string): Promise<void> {
    const { createDir } = await import('@tauri-apps/plugin-fs')
    const fullPath = joinPath(vaultId, normalizePath(path))
    await createDir(fullPath, { recursive: true })
  }

  async deleteFolder(vaultId: string, path: string): Promise<void> {
    const { removeDir } = await import('@tauri-apps/plugin-fs')
    const fullPath = joinPath(vaultId, normalizePath(path))
    await removeDir(fullPath, { recursive: true })
  }

  async getFileTree(vaultId: string): Promise<FileTreeNode> {
    const { invoke } = await import('@tauri-apps/api/core')
    const tree = await invoke<FileTreeNode>('markdown_get_file_tree', {
      vaultPath: vaultId
    })
    return tree
  }

  async watchVault(
    vaultId: string,
    callback: (event: FileChangeEvent) => void
  ): Promise<() => void> {
    const { invoke } = await import('@tauri-apps/api/core')

    const unsubscribe = await invoke<() => void>('markdown_watch_vault', {
      vaultPath: vaultId,
      callback: (event: any) => {
        callback({
          type: event.type,
          path: event.path,
          oldPath: event.old_path
        })
      }
    })

    this.watchers.set(vaultId, unsubscribe)
    return unsubscribe
  }

  private async initializeIndex(indexPath: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('markdown_init_index', { indexPath })
  }

  private async indexNote(vaultId: string, path: string, content: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core')
    const indexPath = joinPath(vaultId, '.vault', 'index.db')
    const { frontmatter, body } = parseFrontmatter(content)
    const tags = extractTags(content)
    const title = frontmatter.title || basename(path).replace(/\.md$/, '')
    const wordCount = body.split(/\s+/).filter(Boolean).length

    await invoke('markdown_index_note', {
      indexPath,
      path: normalizePath(path),
      title,
      content: body,
      frontmatter: JSON.stringify(frontmatter),
      tags: JSON.stringify(tags),
      aliases: JSON.stringify(frontmatter.aliases || []),
      wordCount,
      checksum: await calculateChecksum(content)
    })
  }

  private async removeFromIndex(vaultId: string, path: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core')
    const indexPath = joinPath(vaultId, '.vault', 'index.db')
    await invoke('markdown_remove_from_index', {
      indexPath,
      path: normalizePath(path)
    })
  }

}


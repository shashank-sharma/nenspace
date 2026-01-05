import { getStorageAdapter } from './storage'
import { LinkIndexService } from './link-index.service'
import { dailyNotesService } from './daily-notes.service'
import { templatesService } from './templates.service'
import { searchService } from './search.service'
import type { Vault, Note, NoteMetadata, FileTreeNode } from '../types'

export class MarkdownService {
  private linkIndexes = new Map<string, LinkIndexService>()

  getLinkIndex(vaultId: string): LinkIndexService {
    if (!this.linkIndexes.has(vaultId)) {
      this.linkIndexes.set(vaultId, new LinkIndexService(vaultId))
    }
    return this.linkIndexes.get(vaultId)!
  }

  async rebuildLinkIndex(vaultId: string): Promise<void> {
    const index = this.getLinkIndex(vaultId)
    await index.buildIndex()
  }
}

export const markdownService = new MarkdownService()


import { getStorageAdapter } from './storage'
import { getDailyNotePath } from '../utils'
import { vaultStore } from '../stores'
import type { Note, VaultSettings } from '../types'

export class DailyNotesService {
  async getTodayNote(): Promise<Note | null> {
    const vault = vaultStore.activeVault
    if (!vault) return null

    const today = new Date()
    const path = getDailyNotePath(today, vault.settings.dailyNoteFormat, vault.settings.dailyNoteFolder)

    try {
      const storage = await getStorageAdapter()
      return await storage.readNote(vault.id, path)
    } catch {
      return null
    }
  }

  async createDailyNote(date: Date): Promise<Note> {
    const vault = vaultStore.activeVault
    if (!vault) throw new Error('No active vault')

    const path = getDailyNotePath(date, vault.settings.dailyNoteFormat, vault.settings.dailyNoteFolder)
    const template = vault.settings.dailyNoteTemplate

    let content = `# ${date.toLocaleDateString()}\n\n`

    if (template) {
      try {
        const storage = await getStorageAdapter()
        const templateNote = await storage.readNote(vault.id, template)
        content = this.renderTemplate(templateNote.content, {
          date: date.toISOString().split('T')[0],
          time: date.toTimeString().split(' ')[0],
          datetime: date.toISOString()
        })
      } catch {
      }
    }

    const storage = await getStorageAdapter()
    return await storage.createNote(vault.id, path, content)
  }

  async getDailyNoteForDate(date: Date): Promise<Note | null> {
    const vault = vaultStore.activeVault
    if (!vault) return null

    const path = getDailyNotePath(date, vault.settings.dailyNoteFormat, vault.settings.dailyNoteFolder)

    try {
      const storage = await getStorageAdapter()
      return await storage.readNote(vault.id, path)
    } catch {
      return null
    }
  }

  private renderTemplate(content: string, vars: Record<string, string>): string {
    let rendered = content
    for (const [key, value] of Object.entries(vars)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }
    return rendered
  }
}

export const dailyNotesService = new DailyNotesService()


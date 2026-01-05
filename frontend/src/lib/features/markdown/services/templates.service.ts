import { getStorageAdapter } from './storage'
import { vaultStore } from '../stores'
import type { NoteMetadata, Note } from '../types'

export class TemplatesService {
  async listTemplates(): Promise<NoteMetadata[]> {
    const vault = vaultStore.activeVault
    if (!vault) return []

    const storage = await getStorageAdapter()
    const allNotes = await storage.listNotes(vault.id, vault.settings.templateFolder)

    return allNotes.filter(note => note.isTemplate)
  }

  async createFromTemplate(templatePath: string, newPath: string): Promise<Note> {
    const vault = vaultStore.activeVault
    if (!vault) throw new Error('No active vault')

    const storage = await getStorageAdapter()
    const template = await storage.readNote(vault.id, templatePath)

    const title = basename(newPath).replace(/\.md$/, '')
    const rendered = this.renderTemplate(template.content, {
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0],
      datetime: new Date().toISOString(),
      title
    })

    return await storage.createNote(vault.id, newPath, rendered)
  }

  renderTemplate(content: string, vars: Record<string, string>): string {
    let rendered = content
    for (const [key, value] of Object.entries(vars)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }
    return rendered
  }
}

function basename(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] || path
}

export const templatesService = new TemplatesService()


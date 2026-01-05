import { stringifyFrontmatter, parseFrontmatter } from './frontmatter'
import { extractTags } from './link-parser'
import { basename, normalizePath } from './path'
import type { Note, NoteMetadata } from '../types'

export function recordToNoteMetadata(
  record: any,
  vaultId: string,
  existingMetadata?: NoteMetadata
): NoteMetadata {
  return {
    id: record.id,
    vaultId: record.vault || vaultId,
    title: record.title,
    path: record.path,
    created: new Date(record.created),
    updated: new Date(record.updated),
    tags: record.tags || [],
    aliases: record.aliases || [],
    linkCount: existingMetadata?.linkCount ?? 0,
    backlinkCount: existingMetadata?.backlinkCount ?? 0,
    wordCount: record.word_count || 0,
    isStarred: record.is_starred || false,
    isTemplate: record.is_template || false
  }
}

export function recordToNote(record: any, vaultId: string): Note {
  const frontmatter = record.frontmatter || {}
  const body = record.content || ''
  const fullContent = stringifyFrontmatter(frontmatter, body)

  return {
    id: record.id,
    vaultId,
    title: record.title,
    path: record.path,
    content: fullContent,
    frontmatter,
    checksum: record.checksum || '',
    created: new Date(record.created),
    updated: new Date(record.updated),
    wordCount: record.word_count || 0,
    tags: record.tags || [],
    aliases: record.aliases || [],
    syncStatus: 'synced',
    remoteId: record.id,
    remoteChecksum: record.checksum || null,
    lastSynced: new Date(record.updated),
    isStarred: record.is_starred || false,
    isTemplate: record.is_template || false
  }
}

export function createNoteMetadata(note: Note): NoteMetadata {
  return {
    id: note.id,
    vaultId: note.vaultId,
    title: note.title,
    path: note.path,
    created: note.created,
    updated: note.updated,
    tags: note.tags,
    aliases: note.aliases,
    linkCount: 0,
    backlinkCount: 0,
    wordCount: note.wordCount,
    isStarred: note.isStarred,
    isTemplate: note.isTemplate
  }
}

export function contentToNote(
  vaultId: string,
  path: string,
  content: string,
  id?: string
): Note {
  const { frontmatter, body } = parseFrontmatter(content)
  const tags = extractTags(content)
  const title = frontmatter.title || basename(path).replace(/\.md$/, '')
  const wordCount = body.split(/\s+/).filter(Boolean).length

  return {
    id: id || '',
    vaultId,
    title,
    path: normalizePath(path),
    content,
    frontmatter,
    checksum: '',
    created: new Date(),
    updated: new Date(),
    wordCount,
    tags,
    aliases: frontmatter.aliases || [],
    syncStatus: 'local-only',
    remoteId: null,
    remoteChecksum: null,
    lastSynced: null,
    isStarred: false,
    isTemplate: false
  }
}


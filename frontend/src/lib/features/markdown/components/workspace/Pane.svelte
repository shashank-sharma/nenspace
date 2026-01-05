<script lang="ts">
  import { notesStore, vaultStore, workspaceStore } from '../../stores'
  import { MarkdownEditor } from '../editor'
  import MarkdownPreview from '../MarkdownPreview.svelte'
  import NotesDashboard from '../NotesDashboard.svelte'
  import TabBar from './TabBar.svelte'
  import type { PaneState } from '../../types'

  interface Props {
    pane: PaneState
  }

  let { pane }: Props = $props()

  let lastActiveTabId = $state<string | null>(null)
  let editMode = $state(false)
  let lastActiveNoteId = $state<string | null>(null)

  $effect(async () => {
    const activeTabId = pane.activeTabId
    const activeVault = vaultStore.activeVault

    if (!activeTabId) {
      if (lastActiveTabId) {
        lastActiveTabId = null
        lastActiveNoteId = null
        editMode = false
        notesStore.setActiveNote(null)
      }
      return
    }

    if (activeTabId === lastActiveTabId && notesStore.activeNote) {
      return
    }

    if (!activeVault) {
      return
    }

    lastActiveTabId = activeTabId
    editMode = false

    const tab = pane.tabs.find(t => t.id === activeTabId)
    if (!tab) {
      return
    }

    if (notesStore.notes.length === 0) {
      await notesStore.loadNotes(activeVault.id)
    }

    const currentNote = notesStore.activeNote
    if (!currentNote || currentNote.path !== tab.notePath) {
      try {
        await notesStore.loadNote(activeVault.id, tab.notePath)
      } catch (err) {
      }
    }
  })

  $effect(() => {
    if (notesStore.activeNote) {
      if (notesStore.activeNote.id !== lastActiveNoteId) {
        editMode = false
        lastActiveNoteId = notesStore.activeNote.id
      }
    } else {
      lastActiveNoteId = null
      editMode = false
    }
  })

  async function handleSave(content: string) {
    const tab = pane.tabs.find(t => t.id === pane.activeTabId)
    if (!tab || !notesStore.activeNote) return

    const vaultId = notesStore.activeNote.vaultId
    await notesStore.updateNote(vaultId, tab.notePath, content)
  }

  function toggleEditMode() {
    editMode = !editMode
  }

  async function handleWikiLinkClick(noteName: string) {
    if (!vaultStore.activeVault) return

    const notes = notesStore.notes
    const targetNote = notes.find(
      n => n.title.toLowerCase() === noteName.toLowerCase() ||
           n.path.toLowerCase().includes(noteName.toLowerCase())
    )

    if (targetNote) {
      const note = await notesStore.loadNote(vaultStore.activeVault.id, targetNote.path)
      if (note) {
        workspaceStore.createTab(note.id, note.path, vaultStore.activeVault.id)
      }
    }
  }
</script>

<div class="pane h-full flex-1 flex flex-col min-w-0">
  <TabBar {pane} />

  <div class="flex-1 overflow-hidden w-full">
    {#if pane.activeTabId}
      {@const tab = pane.tabs.find(t => t.id === pane.activeTabId)}
      {@const note = notesStore.activeNote}
      {#if tab && note && note.path === tab.notePath}
        {#if editMode}
          <MarkdownEditor {note} onSave={handleSave} />
        {:else}
          <MarkdownPreview
            {note}
            {editMode}
            onToggleEdit={toggleEditMode}
            on:noteClick={(e) => handleWikiLinkClick(e.detail.noteName)}
          />
        {/if}
      {:else if tab}
        <div class="h-full flex items-center justify-center">
          <div class="text-center space-y-2">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p class="text-sm text-muted-foreground">Loading note...</p>
          </div>
        </div>
      {/if}
    {:else}
      <div class="h-full w-full">
        <NotesDashboard />
      </div>
    {/if}
  </div>
</div>


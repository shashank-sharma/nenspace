<script lang="ts">
  import { onMount } from 'svelte'
  import { vaultStore, notesStore, workspaceStore } from '../stores'
  import NotesDashboard from './NotesDashboard.svelte'
  import FileExplorer from './FileExplorer.svelte'
  import QuickSwitcher from './QuickSwitcher.svelte'
  import BacklinksPanel from './BacklinksPanel.svelte'
  import GraphView from './GraphView.svelte'
  import ConflictDialog from './ConflictDialog.svelte'
  import TemplateDialog from './TemplateDialog.svelte'
  import DailyNoteButton from './DailyNoteButton.svelte'
  import VaultSetupView from './VaultSetupView.svelte'
  import MarkdownStatusBar from './MarkdownStatusBar.svelte'
  import Workspace from './workspace/Workspace.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { syncStore } from '../stores'
  import type { ConflictResolution } from '../types'
  import { Search, Settings, FileText, Star, Hash, Edit, Eye, Home, Link as LinkIcon, Calendar, Tag } from 'lucide-svelte'
  import { DateUtil } from '$lib/utils'

  let showQuickSwitcher = $state(false)
  let showGraph = $state(false)
  let showBacklinks = $state(true)
  let showTemplates = $state(false)
  let activeConflict = $state<typeof syncStore.state.conflicts[0] | null>(null)
  let conflictDialogOpen = $state(false)
  let isInitialized = $state(false)

  onMount(async () => {
    await vaultStore.initialize()
    isInitialized = true

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault()
        showQuickSwitcher = true
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault()
        showGraph = !showGraph
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  async function handleNoteSelect(path: string) {
    if (!vaultStore.activeVault) return

    const note = await notesStore.loadNote(vaultStore.activeVault.id, path)
    if (note) {
      workspaceStore.createTab(note.id, note.path, vaultStore.activeVault.id)
    }
  }

  async function handleTemplateSelect(e: CustomEvent<{ templatePath: string }>) {
    if (!vaultStore.activeVault) return

    const { templatesService } = await import('../services')
    const newPath = `new-note-${Date.now()}.md`
    await templatesService.createFromTemplate(e.detail.templatePath, newPath)
    await handleNoteSelect(newPath)
  }

  async function handleConflictResolve(e: CustomEvent<{ conflictId: string; resolution: ConflictResolution }>) {
    const { SyncEngine } = await import('../services')
    const pb = (await import('$lib/config/pocketbase')).pb
    const engine = new SyncEngine(pb.baseUrl)

    if (vaultStore.activeVault) {
      await engine.resolveConflict(
        e.detail.conflictId,
        e.detail.resolution,
        vaultStore.activeVault,
        activeConflict?.noteId || ''
      )
    }

    syncStore.resolveConflict(e.detail.conflictId)
    activeConflict = null
    conflictDialogOpen = false
  }

  let lastVaultId = $state<string | null>(null)

  $effect(async () => {
    if (vaultStore.activeVault && vaultStore.activeVault.id !== lastVaultId) {
      const newVaultId = vaultStore.activeVault.id
      if (lastVaultId) {
        workspaceStore.clearForVault(lastVaultId)
      }
      lastVaultId = newVaultId
      workspaceStore.initialize(newVaultId)
      await notesStore.loadNotes(newVaultId)
    }
  })

  $effect(() => {
    if (syncStore.state.conflicts.length > 0 && !activeConflict) {
      activeConflict = syncStore.state.conflicts[0]
      conflictDialogOpen = true
    }
  })

  async function handleVaultChange() {
    vaultStore.setActiveVault('')
    await vaultStore.initialize()
  }

  async function handleWikiLinkClick(noteName: string) {
    if (!vaultStore.activeVault) return

    const notes = notesStore.notes
    const targetNote = notes.find(
      n => n.title.toLowerCase() === noteName.toLowerCase() ||
           n.path.toLowerCase().includes(noteName.toLowerCase())
    )

    if (targetNote) {
      await handleNoteSelect(targetNote.path)
    }
  }

  function handleNoteClick(e: CustomEvent<{ noteName: string }>) {
    handleWikiLinkClick(e.detail.noteName)
  }
</script>

{#if !isInitialized || vaultStore.loading}
  <div class="h-full flex items-center justify-center">
    <div class="text-center space-y-2">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      <p class="text-sm text-muted-foreground">Loading vault...</p>
    </div>
  </div>
{:else if !vaultStore.activeVault}
  <VaultSetupView />
{:else}
  <div class="markdown-feature h-full flex flex-col gap-4 p-4">
    <div class="w-full">
      {#if notesStore.activeNote}
        {@const note = notesStore.activeNote}
        {@const noteMetadata = notesStore.notes.find(n => n.id === note.id)}
        <h2 class="text-2xl font-bold mb-2">{note.title}</h2>
        <div class="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {#if noteMetadata}
            <div class="flex items-center gap-1">
              <FileText class="w-4 h-4" />
              <span>{noteMetadata.wordCount.toLocaleString()} words</span>
            </div>
            {#if noteMetadata.linkCount > 0}
              <div class="flex items-center gap-1">
                <LinkIcon class="w-4 h-4" />
                <span>{noteMetadata.linkCount} links</span>
              </div>
            {/if}
            {#if noteMetadata.backlinkCount > 0}
              <div class="flex items-center gap-1">
                <LinkIcon class="w-4 h-4" />
                <span>{noteMetadata.backlinkCount} backlinks</span>
              </div>
            {/if}
            {#if noteMetadata.tags && noteMetadata.tags.length > 0}
              <div class="flex items-center gap-1">
                <Tag class="w-4 h-4" />
                <span>{noteMetadata.tags.length} tags</span>
              </div>
            {/if}
            <div class="flex items-center gap-1">
              <Calendar class="w-4 h-4" />
              <span>Updated {DateUtil.formatRelative(note.updated, { includeTime: true })}</span>
            </div>
            {#if noteMetadata.isStarred}
              <div class="flex items-center gap-1">
                <Star class="w-4 h-4 fill-yellow-500 text-yellow-500" />
                <span>Starred</span>
              </div>
            {/if}
            {#if noteMetadata.isTemplate}
              <div class="flex items-center gap-1">
                <FileText class="w-4 h-4" />
                <span>Template</span>
              </div>
            {/if}
          {:else}
            <div class="flex items-center gap-1">
              <FileText class="w-4 h-4" />
              <span>{note.wordCount.toLocaleString()} words</span>
            </div>
            <div class="flex items-center gap-1">
              <Calendar class="w-4 h-4" />
              <span>Updated {DateUtil.formatRelative(note.updated, { includeTime: true })}</span>
            </div>
          {/if}
        </div>
      {:else}
        <h2 class="text-2xl font-bold mb-2">Vault Overview</h2>
        <p class="text-sm text-muted-foreground">
          Insights and statistics about your notes
        </p>
      {/if}
    </div>
    <div class="flex flex-col md:flex-row gap-4 flex-1 overflow-hidden">
      <aside class="w-full md:w-64 flex flex-col gap-4 hidden md:flex">
        <Card class="flex-1 flex flex-col overflow-hidden">
        <CardHeader class="px-4 py-2 border-b">
          <div class="flex items-center justify-between gap-2">
            <CardTitle class="text-sm font-semibold truncate">Notes</CardTitle>
            <div class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                on:click={() => {
                  const activeTab = workspaceStore.activeTab
                  if (activeTab && vaultStore.activeVault) {
                    workspaceStore.closeTab(
                      workspaceStore.activePane?.id || '',
                      activeTab.id,
                      vaultStore.activeVault.id
                    )
                  }
                  notesStore.setActiveNote(null)
                }}
                title="Home - Open dashboard"
              >
                <Home class="w-4 h-4" />
              </Button>
              <DailyNoteButton />
              <Button
                variant="ghost"
                size="sm"
                on:click={() => showQuickSwitcher = true}
                title="Quick switcher (Ctrl+O)"
              >
                <Search class="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                on:click={() => showGraph = !showGraph}
                title="Graph view (Ctrl+G)"
              >
                <Hash class="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                on:click={() => showTemplates = true}
                title="Templates"
              >
                <FileText class="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                title="Settings"
              >
                <Settings class="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent class="flex-1 p-0 overflow-hidden">
          <FileExplorer on:noteSelect={(e) => handleNoteSelect(e.detail.path)} />
        </CardContent>
      </Card>
      {#if showBacklinks}
        <Card class="h-64 flex flex-col overflow-hidden">
          <CardHeader class="px-4 py-2 border-b">
            <CardTitle class="text-sm font-semibold">Backlinks</CardTitle>
          </CardHeader>
          <CardContent class="flex-1 p-0 overflow-hidden">
            <BacklinksPanel />
          </CardContent>
        </Card>
      {/if}
      </aside>

      <main class="flex-1 overflow-hidden flex flex-col">
        <div class="flex-1 overflow-hidden flex flex-col">
          {#if showGraph}
            <GraphView />
          {:else}
            <Workspace />
          {/if}
        </div>

        <MarkdownStatusBar />
      </main>
    </div>

    {#if showQuickSwitcher}
      <QuickSwitcher on:close={() => showQuickSwitcher = false} />
    {/if}

    {#if showTemplates}
      <TemplateDialog bind:open={showTemplates} onSelect={handleTemplateSelect} />
    {/if}

    {#if activeConflict}
      <ConflictDialog
        conflict={activeConflict}
        bind:open={conflictDialogOpen}
        on:resolve={handleConflictResolve}
      />
    {/if}
  </div>
{/if}


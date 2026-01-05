<script lang="ts">
  import { vaultStore, notesStore } from '../stores'
  import { templatesService } from '../services'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
  } from '$lib/components/ui/dialog'
  import {
    Select as SelectRoot,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
  } from '$lib/components/ui/select'
  import { NotificationBroadcaster } from '$lib/features/status-indicator'
  import { FilePlus, Loader2 } from 'lucide-svelte'
  import { normalizePath } from '../utils'

  interface Props {
    open?: boolean
    folder?: string
  }

  let { open = $bindable(false), folder = '' }: Props = $props()

  let noteName = $state('')
  let useTemplate = $state(false)
  let selectedTemplate = $state<string | null>(null)
  let templates = $state<typeof notesStore.notes>([])
  let creating = $state(false)
  let loadingTemplates = $state(false)

  $effect(async () => {
    if (open && useTemplate && vaultStore.activeVault) {
      await loadTemplates()
    }
  })

  async function loadTemplates() {
    if (!vaultStore.activeVault) return
    loadingTemplates = true
    try {
      const allTemplates = await templatesService.listTemplates()
      templates = allTemplates
    } finally {
      loadingTemplates = false
    }
  }

  async function handleCreate() {
    if (!vaultStore.activeVault || !noteName.trim()) return

    creating = true
    try {
      let path = normalizePath(noteName.trim())
      if (!path.endsWith('.md')) {
        path = `${path}.md`
      }

      if (folder) {
        path = folder.endsWith('/') ? `${folder}${path}` : `${folder}/${path}`
      }

      let content = `# ${noteName.trim()}\n\n`

      if (useTemplate && selectedTemplate) {
        const note = await templatesService.createFromTemplate(selectedTemplate, path)
        await notesStore.loadNote(vaultStore.activeVault.id, note.path)
      } else {
        await notesStore.createNote(vaultStore.activeVault.id, path, content)
        await notesStore.loadNote(vaultStore.activeVault.id, path)
      }

      open = false
      noteName = ''
      useTemplate = false
      selectedTemplate = null
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create note'
      NotificationBroadcaster.error(errorMessage, { duration: 5000 })
    } finally {
      creating = false
    }
  }
</script>

<Dialog bind:open>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create New Note</DialogTitle>
      <DialogDescription>
        Enter a name for your new note
      </DialogDescription>
    </DialogHeader>

    <div class="space-y-4">
      <div>
        <Label for="note-name">Note Name</Label>
        <Input
          id="note-name"
          bind:value={noteName}
          placeholder="my-note"
          on:keydown={(e) => {
            if (e.key === 'Enter' && !creating) {
              handleCreate()
            }
          }}
          disabled={creating}
        />
        <p class="text-xs text-muted-foreground mt-1">
          {folder ? `Will be created in: ${folder}` : 'Will be created in root'}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <input
          type="checkbox"
          id="use-template"
          bind:checked={useTemplate}
          class="rounded"
        />
        <Label for="use-template" class="cursor-pointer">Use template</Label>
      </div>

      {#if useTemplate}
        <div>
          <Label>Template</Label>
          <SelectRoot bind:value={selectedTemplate} disabled={loadingTemplates}>
            <SelectTrigger>
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {#each templates as template}
                <SelectItem value={template.path}>{template.title}</SelectItem>
              {/each}
            </SelectContent>
          </SelectRoot>
        </div>
      {/if}
    </div>

    <DialogFooter>
      <Button variant="outline" on:click={() => open = false} disabled={creating}>
        Cancel
      </Button>
      <Button on:click={handleCreate} disabled={creating || !noteName.trim()}>
        {#if creating}
          <Loader2 class="w-4 h-4 mr-2 animate-spin" />
        {:else}
          <FilePlus class="w-4 h-4 mr-2" />
        {/if}
        Create
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>


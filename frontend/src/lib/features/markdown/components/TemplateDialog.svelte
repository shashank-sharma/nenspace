<script lang="ts">
  import { onMount } from 'svelte'
  import { createEventDispatcher } from 'svelte'
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { templatesService } from '../services'
  import type { NoteMetadata } from '../types'

  interface Props {
    open?: boolean
    onSelect?: ((templatePath: string) => Promise<void>) | null
  }

  let { open = $bindable(false), onSelect = null }: Props = $props()

  const dispatch = createEventDispatcher<{ select: { templatePath: string } }>()

  let templates = $state<NoteMetadata[]>([])
  let loading = $state(false)

  onMount(async () => {
    if (open) {
      await loadTemplates()
    }
  })

  $effect(async () => {
    if (open) {
      await loadTemplates()
    }
  })

  async function loadTemplates() {
    loading = true
    try {
      templates = await templatesService.listTemplates()
    } finally {
      loading = false
    }
  }

  async function handleSelect(templatePath: string) {
    if (onSelect) {
      await onSelect(templatePath)
    }
    dispatch('select', { templatePath })
    open = false
  }
</script>

<Dialog bind:open>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Select Template</DialogTitle>
    </DialogHeader>

    {#if loading}
      <div class="p-4 text-center text-muted-foreground">Loading templates...</div>
    {:else if templates.length === 0}
      <div class="p-4 text-center text-muted-foreground">No templates found</div>
    {:else}
      <div class="space-y-2 max-h-96 overflow-auto">
        {#each templates as template}
          <div
            class="p-3 border rounded hover:bg-accent cursor-pointer"
            on:click={() => handleSelect(template.path)}
          >
            <div class="font-medium">{template.title}</div>
            <div class="text-sm text-muted-foreground">{template.path}</div>
          </div>
        {/each}
      </div>
    {/if}

    <DialogFooter>
      <Button variant="outline" on:click={() => open = false}>Cancel</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>


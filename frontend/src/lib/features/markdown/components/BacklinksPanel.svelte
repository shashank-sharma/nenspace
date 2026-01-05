<script lang="ts">
  import { onMount } from 'svelte'
  import { notesStore, vaultStore } from '../stores'
  import { markdownService } from '../services'
  import type { BackLink } from '../types'

  let backlinks = $state<BackLink[]>([])

  onMount(async () => {
    await loadBacklinks()
  })

  let lastNotePath = $state<string | null>(null)

  $effect(async () => {
    if (notesStore.activeNote && notesStore.activeNote.path !== lastNotePath) {
      lastNotePath = notesStore.activeNote.path
      await loadBacklinks()
    }
  })

  async function loadBacklinks() {
    if (!vaultStore.activeVault || !notesStore.activeNote) {
      backlinks = []
      return
    }

    const linkIndex = markdownService.getLinkIndex(vaultStore.activeVault.id)

    if (!linkIndex.isBuilt) {
      await linkIndex.buildIndex()
    }

    backlinks = linkIndex.getBacklinks(notesStore.activeNote.path)
  }

  async function handleBacklinkClick(path: string) {
    if (!vaultStore.activeVault) return
    await notesStore.loadNote(vaultStore.activeVault.id, path)
  }
</script>

<div class="backlinks-panel h-full overflow-auto p-4">
  {#if backlinks.length === 0}
    <p class="text-sm text-muted-foreground">No backlinks</p>
  {:else}
    <div class="space-y-3">
      {#each backlinks as backlink}
        <div
          class="p-3 rounded border hover:bg-accent cursor-pointer"
          on:click={() => handleBacklinkClick(backlink.sourceNotePath)}
        >
          <div class="font-medium text-sm mb-1">{backlink.sourceNoteTitle}</div>
          <div class="text-xs text-muted-foreground line-clamp-2">
            {backlink.context}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>


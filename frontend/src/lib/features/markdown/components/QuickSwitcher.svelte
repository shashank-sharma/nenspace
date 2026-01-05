<script lang="ts">
  import { onMount } from 'svelte'
  import { vaultStore, notesStore, searchStore } from '../stores'
  import { searchService } from '../services'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  let query = $state('')
  let results = $state<typeof notesStore.notes>([])
  let selectedIndex = $state(0)

  onMount(async () => {
    if (vaultStore.activeVault) {
      results = await searchService.quickSearch(vaultStore.activeVault.id, '', 20)
    }
  })

  $effect(async () => {
    if (!vaultStore.activeVault) return
    results = await searchService.quickSearch(vaultStore.activeVault.id, query, 20)
    selectedIndex = 0
  })

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedIndex = Math.max(selectedIndex - 1, 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex].path)
      }
    } else if (e.key === 'Escape') {
      dispatch('close')
    }
  }

  async function handleSelect(path: string) {
    if (!vaultStore.activeVault) return
    await notesStore.loadNote(vaultStore.activeVault.id, path)
    dispatch('close')
  }
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
  on:click={() => dispatch('close')}
  on:keydown={handleKeyDown}
  role="dialog"
  tabindex="-1"
>
  <div
    class="bg-background border rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-hidden"
    on:click|stopPropagation
  >
    <input
      bind:value={query}
      type="text"
      placeholder="Search notes..."
      class="w-full px-4 py-3 text-lg border-b focus:outline-none"
      autofocus
    />

    <div class="max-h-96 overflow-auto">
      {#each results as note, index}
        <div
          class="px-4 py-2 hover:bg-accent cursor-pointer {index === selectedIndex ? 'bg-accent' : ''}"
          on:click={() => handleSelect(note.path)}
        >
          <div class="font-medium">{note.title}</div>
          <div class="text-sm text-muted-foreground">{note.path}</div>
        </div>
      {/each}
    </div>
  </div>
</div>


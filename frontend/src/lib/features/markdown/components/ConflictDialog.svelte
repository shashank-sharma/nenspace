<script lang="ts">
  import { createEventDispatcher } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '$lib/components/ui/dialog'
  import type { ConflictRecord, ConflictResolution } from '../types'

  interface Props {
    conflict?: ConflictRecord | null
    open?: boolean
  }

  let { conflict = $bindable(null), open = $bindable(false) }: Props = $props()

  const dispatch = createEventDispatcher<{
    resolve: { conflictId: string; resolution: ConflictResolution }
  }>()

  let manualContent = $state('')

  $effect(() => {
    if (conflict && open) {
      manualContent = conflict.localVersion.content
    }
  })

  function handleResolve(type: ConflictResolution['type']) {
    if (!conflict) return

    const resolution: ConflictResolution =
      type === 'manual'
        ? { type: 'manual', content: manualContent }
        : { type }

    dispatch('resolve', {
      conflictId: conflict.id,
      resolution
    })

    open = false
  }

</script>

<Dialog bind:open>
  <DialogContent class="max-w-4xl max-h-[90vh] overflow-auto">
    <DialogHeader>
      <DialogTitle>Resolve Conflict</DialogTitle>
    </DialogHeader>

    {#if conflict}
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <h4 class="text-sm font-semibold mb-2">Local Version</h4>
            <div class="border rounded p-3 h-64 overflow-auto text-sm font-mono">
              {#each conflict.localVersion.content.split('\n') as line, i}
                <div class="bg-green-50 dark:bg-green-900/20">{line}</div>
              {/each}
            </div>
          </div>

          <div>
            <h4 class="text-sm font-semibold mb-2">Remote Version</h4>
            <div class="border rounded p-3 h-64 overflow-auto text-sm font-mono">
              {#each conflict.remoteVersion.content.split('\n') as line, i}
                <div class="bg-blue-50 dark:bg-blue-900/20">{line}</div>
              {/each}
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <Button variant="outline" on:click={() => handleResolve('keep-local')}>
            Keep Local
          </Button>
          <Button variant="outline" on:click={() => handleResolve('keep-remote')}>
            Keep Remote
          </Button>
          <Button variant="outline" on:click={() => handleResolve('keep-both')}>
            Keep Both
          </Button>
        </div>

        <div>
          <h4 class="text-sm font-semibold mb-2">Manual Merge</h4>
          <textarea
            bind:value={manualContent}
            class="w-full h-48 border rounded p-2 font-mono text-sm"
            placeholder="Edit content manually..."
          ></textarea>
          <Button variant="default" on:click={() => handleResolve('manual')} class="mt-2">
            Save Manual Merge
          </Button>
        </div>
      </div>
    {/if}

    <DialogFooter>
      <Button variant="outline" on:click={() => open = false}>Cancel</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>


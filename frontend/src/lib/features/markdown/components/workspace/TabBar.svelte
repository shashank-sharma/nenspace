<script lang="ts">
  import { workspaceStore, vaultStore } from '../../stores'
  import type { PaneState, TabState } from '../../types'
  import { X } from 'lucide-svelte'

  interface Props {
    pane: PaneState
  }

  let { pane }: Props = $props()

  function handleTabClick(tabId: string) {
    const vaultId = vaultStore.activeVault?.id
    workspaceStore.setActiveTab(pane.id, tabId, vaultId)
  }

  function handleCloseTab(e: MouseEvent, tabId: string) {
    e.stopPropagation()
    const vaultId = vaultStore.activeVault?.id
    workspaceStore.closeTab(pane.id, tabId, vaultId)
  }
</script>

<div class="tab-bar flex border-b bg-muted/50 overflow-x-auto">
  {#each pane.tabs as tab}
    <div
      class="group flex items-center gap-2 px-3 py-2 border-r cursor-pointer hover:bg-accent transition-colors {tab.id === pane.activeTabId ? 'bg-background border-b-2 border-b-primary' : ''}"
      on:click={() => handleTabClick(tab.id)}
    >
      <span class="text-sm truncate max-w-[200px]">{tab.notePath.split('/').pop()}</span>
      <button
        class="opacity-0 group-hover:opacity-100 hover:bg-destructive/20 rounded p-0.5 transition-opacity flex-shrink-0"
        on:click={(e) => handleCloseTab(e, tab.id)}
        title="Close tab"
      >
        <X class="w-3 h-3" />
      </button>
    </div>
  {/each}
</div>


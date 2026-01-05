<script lang="ts">
  import { workspaceStore } from '../../stores'
  import Pane from './Pane.svelte'
  import PaneSplitter from './PaneSplitter.svelte'
</script>

<div class="workspace h-full w-full flex" class:split-horizontal={workspaceStore.state.layout === 'split-horizontal'} class:split-vertical={workspaceStore.state.layout === 'split-vertical'}>
  {#each workspaceStore.state.panes as pane, index}
    <Pane {pane} />
    {#if index < workspaceStore.state.panes.length - 1}
      <PaneSplitter />
    {/if}
  {/each}
</div>

<style>
  .workspace.split-horizontal {
    flex-direction: row;
  }

  .workspace.split-vertical {
    flex-direction: column;
  }
</style>


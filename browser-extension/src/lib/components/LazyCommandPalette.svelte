<script lang="ts">
  import { modalStore } from "../stores/modal.store"
  import CommandPalette from "./CommandPalette.svelte"
  
  $: isActive = $modalStore.activeModal === "command-palette"
  
  function handleClose() {
    modalStore.closeModal()
  }
</script>

{#if isActive}
  <CommandPalette onClose={handleClose} />
{:else}
  <div 
    style="position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; z-index: -1;" 
    aria-hidden="true"
    data-command-palette-placeholder="true">
  </div>
{/if}


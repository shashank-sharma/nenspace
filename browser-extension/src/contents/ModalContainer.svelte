<script lang="ts">
  import { modalStore } from "../lib/stores/modal.store"
  import { getModalConfig } from "../lib/config/modals"
  import FloatingModal from "../lib/components/FloatingModal.svelte"
  import CommandPalette from "../lib/components/CommandPalette.svelte"

  $: activeModal = $modalStore.activeModal
  $: triggerPosition = $modalStore.triggerPosition
  $: modalConfig = activeModal && activeModal !== "command-palette" ? getModalConfig(activeModal) : null
  $: modalError = $modalStore.error
  $: isCommandPalette = activeModal === "command-palette"

  function handleClose() {
    modalStore.closeModal()
  }

  function handleNavigateToSettings() {
    modalStore.openModal("settings")
  }

  $: modalProps = {
    onClose: handleClose,
    onNavigateToSettings: handleNavigateToSettings
  }
</script>

{#if isCommandPalette}
  <CommandPalette onClose={handleClose} />
{:else if modalConfig}
  <FloatingModal
    isOpen={true}
    onClose={handleClose}
    title={modalConfig.title}
    position={triggerPosition}
    size={modalConfig.size || "medium"}>
    <svelte:component this={modalConfig.component} {...modalProps} />
  </FloatingModal>
{:else if modalError}
  <div class="modal-error">
    <p>{modalError}</p>
    <button on:click={() => modalStore.clearError()}>Dismiss</button>
  </div>
{/if}

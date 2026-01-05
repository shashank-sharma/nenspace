<script lang="ts">
  import { fade, scale } from "svelte/transition"
  import { quintOut } from "svelte/easing"
  import { onMount, onDestroy } from "svelte"
  import { settingsStorage } from "../services/plasmo-storage.service"
  import { applyThemeToElement } from "../utils/theme.util"
  import { createFocusTrap, type FocusTrap } from "../utils/focus-trap.util"
  import IconClose from "./icons/IconClose.svelte"

  export let isOpen = false
  export let onClose: () => void
  export let position: { x: number; y: number } | undefined = undefined
  export let title: string | undefined = undefined
  export let size: "small" | "medium" | "large" = "medium"

  let modalElement: HTMLElement
  let focusTrap: FocusTrap | null = null
  let escHandler: ((event: KeyboardEvent) => void) | null = null

  onMount(async () => {
    const savedTheme = await settingsStorage.getTheme()

    if (modalElement) {
      applyThemeToElement(modalElement, savedTheme || "auto")
    }

    // Add ESC key handler - use a closure to capture current isOpen state
    escHandler = (event: KeyboardEvent) => {
      // Check if modal is currently open (reactive check)
      if (event.key === "Escape" && !event.defaultPrevented) {
        // Use a small timeout to ensure reactive state is updated
        // But check immediately via DOM presence
        const modalCurrentlyOpen = modalElement && document.contains(modalElement)
        
        if (modalCurrentlyOpen) {
          event.preventDefault()
          event.stopPropagation()
          onClose()
          return
        }
      }
    }

    // Add event listener in capture phase to catch ESC early
    document.addEventListener("keydown", escHandler, true)
  })

  onDestroy(() => {
    if (focusTrap) {
      focusTrap.deactivate()
    }
    
    // Remove ESC handler
    if (escHandler) {
      document.removeEventListener("keydown", escHandler, true)
      escHandler = null
    }
  })

  // Reactive statement to handle focus trap when modal opens/closes
  $: if (isOpen && modalElement) {
    if (!focusTrap) {
      focusTrap = createFocusTrap({
        container: modalElement,
        focusFirst: true,
        restoreFocus: true
      })
    }
    focusTrap.activate()
  } else if (!isOpen && focusTrap) {
    focusTrap.deactivate()
  }

  // Reactive ESC handler - update when isOpen changes
  $: if (isOpen && escHandler) {
    // ESC handler is already attached and will check DOM presence
    // This reactive statement ensures we're aware of state changes
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  $: sizeClass = {
    small: "modal-small",
    medium: "modal-medium",
    large: "modal-large"
  }[size]
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="modal-overlay"
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === "Escape" && isOpen && onClose()}
    role="dialog"
    aria-modal="true"
    aria-labelledby={title ? "modal-title" : undefined}
    tabindex="-1"
    transition:fade={{ duration: 200 }}
    bind:this={modalElement}>
    <div
      class="modal-card {sizeClass}"
      class:positioned={position}
      style={position
        ? `--position-x: ${position.x}px; --position-y: ${position.y}px;`
        : ""}
      transition:scale={{ duration: 300, easing: quintOut, start: 0.95 }}>
      <!-- Accent Border -->
      <div class="modal-accent"></div>

      {#if title}
        <div class="modal-header">
          <div class="title-container">
            <div class="title-decoration"></div>
            <h2 id="modal-title" class="modal-title">{title}</h2>
          </div>
          {#if onClose}
            <button
              class="close-btn"
              on:click={onClose}
              aria-label="Close modal">
              <IconClose size={20} />
            </button>
          {/if}
        </div>
      {/if}

      <div class="modal-content">
        <slot />
      </div>

      <!-- Bottom Decoration -->
      <div class="modal-footer-accent"></div>
    </div>
  </div>
{/if}

<!-- 
  CRITICAL: NO CSS in <style> tags for CSUI child components!
  All styles are injected via getStyle API into Shadow DOM ONLY.
  This prevents CSS from leaking to the page.
  
  Styles are defined in: src/lib/utils/csui-child-components-styles.util.ts
  Function: getFloatingModalStyles()
-->

<style>
  /* All styles moved to getStyle API - prevents CSS leaking to page */
  /* See csui-child-components-styles.util.ts - getFloatingModalStyles() */
</style>

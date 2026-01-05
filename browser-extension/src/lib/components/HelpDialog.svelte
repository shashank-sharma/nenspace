<script lang="ts">
  import { onMount, onDestroy } from "svelte"
  import { fade, scale } from "svelte/transition"
  import { quintOut } from "svelte/easing"
  import { createLogger } from "../utils/logger.util"

  const logger = createLogger("[HelpDialog]")

  export let onClose: () => void

  interface HelpSection {
    title: string
    commands: HelpCommand[]
  }

  interface HelpCommand {
    keys: string[]
    description: string
    category: string
  }

  let helpSections: HelpSection[] = []
  let selectedSection = 0
  let searchQuery = ""
  let filteredSections: HelpSection[] = []

  // Keyboard shortcuts
  const shortcuts: HelpCommand[] = [
    // Navigation
    { keys: ["h"], description: "Scroll left", category: "navigation" },
    { keys: ["j"], description: "Scroll down", category: "navigation" },
    { keys: ["k"], description: "Scroll up", category: "navigation" },
    { keys: ["l"], description: "Scroll right", category: "navigation" },
    { keys: ["gg"], description: "Scroll to top", category: "navigation" },
    { keys: ["G"], description: "Scroll to bottom", category: "navigation" },
    {
      keys: ["d"],
      description: "Scroll down half page",
      category: "navigation"
    },
    { keys: ["u"], description: "Scroll up half page", category: "navigation" },

    // Find
    { keys: ["/"], description: "Enter find mode", category: "find" },
    { keys: ["n"], description: "Next search result", category: "find" },
    { keys: ["N"], description: "Previous search result", category: "find" },

    // History
    { keys: ["H"], description: "Go back", category: "history" },
    { keys: ["L"], description: "Go forward", category: "history" },

    // Tabs
    { keys: ["J"], description: "Previous tab", category: "tabs" },
    { keys: ["K"], description: "Next tab", category: "tabs" },
    { keys: ["t"], description: "New tab", category: "tabs" },
    { keys: ["x"], description: "Close tab", category: "tabs" },
    { keys: ["X"], description: "Restore closed tab", category: "tabs" },

    // Misc
    { keys: ["r"], description: "Reload page", category: "misc" },
    { keys: ["?"], description: "Show this help", category: "misc" },
    { keys: ["Esc"], description: "Exit current mode", category: "misc" }
  ]

  // Extension-specific shortcuts
  const extensionShortcuts: HelpCommand[] = [
    {
      keys: ["Cmd+Shift+K"],
      description: "Open command palette",
      category: "extension"
    },
    { keys: ["Cmd+D"], description: "Add bookmark", category: "extension" },
    { keys: ["Cmd+,"], description: "Open settings", category: "extension" },
    { keys: ["Cmd+Shift+H"], description: "Open home", category: "extension" }
  ]

  let cleanupHandler: (() => void) | null = null

  onMount(() => {
    initializeHelpSections()
    cleanupHandler = setupKeyboardHandlers()
  })

  onDestroy(() => {
    // Cleanup keyboard handler
    if (cleanupHandler) {
      cleanupHandler()
      cleanupHandler = null
    }
  })

  function initializeHelpSections() {
    helpSections = [
      {
        title: "Navigation",
        commands: shortcuts.filter((cmd) => cmd.category === "navigation")
      },
      {
        title: "Find & Search",
        commands: shortcuts.filter((cmd) => cmd.category === "find")
      },
      {
        title: "History",
        commands: shortcuts.filter((cmd) => cmd.category === "history")
      },
      {
        title: "Tabs",
        commands: shortcuts.filter((cmd) => cmd.category === "tabs")
      },
      {
        title: "Extension",
        commands: extensionShortcuts
      },
      {
        title: "Miscellaneous",
        commands: shortcuts.filter((cmd) => cmd.category === "misc")
      }
    ]

    filteredSections = helpSections
  }

  function setupKeyboardHandlers() {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle ESC key - close dialog
      // Use capture phase to catch it early, before ShortcutsHandler
      if (event.key === "Escape") {
        logger.info('[HelpDialog] ESC key pressed - closing help dialog')
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }

      // Stop propagation for other keys to prevent conflicts
      event.stopPropagation()

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault()
          selectedSection = Math.min(
            selectedSection + 1,
            filteredSections.length - 1
          )
          break
        case "ArrowUp":
          event.preventDefault()
          selectedSection = Math.max(selectedSection - 1, 0)
          break
        case "Tab":
          event.preventDefault()
          selectedSection = (selectedSection + 1) % filteredSections.length
          break
      }
    }

    // Use capture phase to catch ESC before ShortcutsHandler
    document.addEventListener("keydown", handleKeyDown, true)

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement
    searchQuery = target.value.toLowerCase()

    if (searchQuery.trim()) {
      filteredSections = helpSections
        .map((section) => ({
          ...section,
          commands: section.commands.filter(
            (cmd) =>
              cmd.description.toLowerCase().includes(searchQuery) ||
              cmd.keys.some((key) => key.toLowerCase().includes(searchQuery))
          )
        }))
        .filter((section) => section.commands.length > 0)
    } else {
      filteredSections = helpSections
    }

    selectedSection = 0
  }


  function getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      navigation: "var(--nenspace-accent-primary)",
      find: "var(--nenspace-accent-secondary)",
      history: "var(--nenspace-accent-tertiary)",
      tabs: "#f59e0b",
      extension: "#8b5cf6",
      misc: "#6b7280"
    }
    return colors[category] || "#6b7280"
  }
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="backdrop" on:click={onClose} transition:fade={{ duration: 200 }}>
</div>

<!-- Help Dialog -->
<div
  class="help-dialog"
  in:scale={{ duration: 300, easing: quintOut, start: 0.9 }}>
  <!-- Header -->
  <div class="header">
    <h1>
      <span class="vim">Vim</span>ium Help
    </h1>
    <div class="header-actions">
      <button class="close-btn" on:click={onClose} aria-label="Close help">
        <span>&times;</span>
      </button>
    </div>
  </div>

  <!-- Search -->
  <div class="search-container">
    <input
      type="text"
      placeholder="Search shortcuts..."
      bind:value={searchQuery}
      on:input={handleSearchInput}
      class="search-input"
      autocomplete="off"
      spellcheck="false" />
  </div>

  <!-- Help Sections -->
  <div class="help-content">
    {#each filteredSections as section, sectionIndex (section.title)}
      <div
        class="help-section"
        class:selected={sectionIndex === selectedSection}>
        <h2
          class="section-title"
          style="color: {getCategoryColor(
            section.commands[0]?.category || 'misc'
          )}">
          {section.title}
        </h2>
        <div class="commands-list">
          {#each section.commands as command (command.description)}
            <div class="command-row">
              <div class="command-keys">
                {#each command.keys as key (key)}
                  <kbd class="key">{key}</kbd>
                {/each}
              </div>
              <div class="command-description">
                {command.description}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-info">
      <p>
        Press <kbd>Esc</kbd> to close • <kbd>↑</kbd><kbd>↓</kbd> to navigate
      </p>
    </div>
  </div>
</div>

<!-- 
  CRITICAL: NO CSS in <style> tags for CSUI child components!
  All styles are injected via getStyle API into Shadow DOM ONLY.
  This prevents CSS from leaking to the page.
  
  Styles are defined in: src/lib/utils/csui-child-components-styles.util.ts
  Function: getHelpDialogStyles()
-->

<style>
  /* All styles moved to getStyle API - prevents CSS leaking to page */
  /* See csui-child-components-styles.util.ts - getHelpDialogStyles() */
</style>

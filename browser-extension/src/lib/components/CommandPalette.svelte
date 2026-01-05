<script lang="ts">
  import { onMount, onDestroy } from "svelte"
  import { scale } from "svelte/transition"
  import { quintOut } from "svelte/easing"
  import IconSearch from "./icons/IconSearch.svelte"
  import IconClose from "./icons/IconClose.svelte"
  import KeyIcon from "./KeyIcon.svelte"
  import { createLogger } from "../utils/logger.util"
  import { highlightMatches } from "../utils/highlight.util"
  import { createSearchDebounce } from "../utils/debounce.util"
  import { sendToBackground } from "@plasmohq/messaging"
  import type { SwitchTabResponse } from "../types/messages"
  import { TimerService } from "../services/timer.service"
  import { Timer } from "lucide-svelte"
  import type { SearchMode, TabResult, OptimizedCommand, TimerCommand } from "../types/command-palette.types"
  import { loadTabs } from "../utils/command-palette/tab.util"
  import { optimizeCommands } from "../utils/command-palette/command.util"
  import { createSlashCommand, filterSlashCommands, type SlashCommandDefinition } from "../utils/command-palette/slash-command.util"
  import { parseTimerCommand, isTimerCommand, extractTimerDuration } from "../utils/command-palette/timer-command.util"
  import { filterCommands, filterTabs } from "../utils/command-palette/filter.util"
  import { createEscapeHandler } from "../utils/command-palette/keyboard.util"
  import { getCompleteCSUIStyle } from "../utils/csui-styles.util"
  import { getModalContainerStyles } from "../utils/modal-container-styles.util"
  import { getAllChildComponentStyles } from "../utils/csui-child-components-styles.util"
  import { getCommandPaletteStyles } from "../utils/command-palette-styles.util"

  const logger = createLogger("[CommandPalette]")

  export let onClose: () => void

  const SLASH_COMMANDS: Record<string, SlashCommandDefinition> = {
    timer: {
      id: "timer",
      label: "timer",
      description: "Start a timer (e.g., /timer 15 min, /timer 1 hr)",
      icon: Timer,
      keywords: ["timer", "countdown", "alarm"]
    }
  }

  const commands: OptimizedCommand[] = optimizeCommands()
  const debouncedSearch = createSearchDebounce(
    async (query: string) => { debouncedQuery = query },
    150
  )

  let searchQuery = ""
  let debouncedQuery = ""
  let selectedIndex = 0
  let inputElement: HTMLInputElement
  let currentMode: SearchMode = "commands"
  let tabs: TabResult[] = []
  let globalEscHandler: ((event: KeyboardEvent) => void) | null = null
  let commandPaletteElement: HTMLDivElement

  $: {
    if (searchQuery.trim()) {
      // Handle promise rejection silently - "Query changed" is expected behavior
      debouncedSearch(searchQuery).catch((error) => {
        // Silently ignore "Query changed" errors - they're expected when user types quickly
        if (error instanceof Error && error.message !== 'Query changed') {
          logger.error("Debounce error", error)
        }
      })
    } else {
      debouncedQuery = ""
    }
  }

  $: queryTerms = debouncedQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  $: isSlashCommand = /^\//.test(debouncedQuery.trim())
  $: isTimerCmd = isTimerCommand(debouncedQuery)
  $: timerDurationText = isTimerCmd ? extractTimerDuration(debouncedQuery) : ""

  $: slashCommandSuggestions = (() => {
    if (!isSlashCommand || isTimerCmd) return []
    const queryAfterSlash = debouncedQuery.trim().substring(1).toLowerCase()
    const filtered = filterSlashCommands(Object.values(SLASH_COMMANDS), queryAfterSlash)
    return filtered.map((cmd) => createSlashCommand(cmd, "/"))
  })()

  let timerCommandSuggestion: OptimizedCommand | null = null
  
  $: timerCommandSuggestion = isTimerCmd ? {
    id: "timer-command",
    label: timerDurationText ? `Start timer: ${timerDurationText}` : "Start timer (e.g., /timer 15 min, /timer 1 hr)",
    description: timerDurationText ? `Start a ${timerDurationText} timer` : "Enter duration after /timer (e.g., 15 min, 1 hr, 60 sec)",
    icon: Timer,
    action: () => {
      const cmd = parseTimerCommand(searchQuery.trim())
      if (cmd) executeTimerCommand(cmd)
    },
    keywords: ["timer", "timer command", "countdown"],
    _searchLabel: "timer",
    _searchDesc: "start timer countdown",
    _searchKeywords: ["timer"],
    _score: 1000
  } : null

  $: filteredCommands = (() => {
    if (isSlashCommand) {
      if (isTimerCmd && timerCommandSuggestion) return [timerCommandSuggestion]
      if (slashCommandSuggestions.length > 0) return slashCommandSuggestions
      return []
    }
    return filterCommands(commands, queryTerms, debouncedQuery)
  })()

  $: filteredTabs = filterTabs(tabs, queryTerms, debouncedQuery)
  $: showResults = searchQuery.trim().length > 0
  $: totalResults = currentMode === "commands" ? filteredCommands.length : filteredTabs.length

  $: {
    if (selectedIndex >= totalResults) {
      selectedIndex = Math.max(0, totalResults - 1)
    }
  }

  onMount(async () => {
    let styleInjectionObserver: MutationObserver | null = null
    let styleInjectionTimeout: number | null = null
    
    const injectStylesDirectly = () => {
      let shadowRoot: ShadowRoot | null = null
      
      if (commandPaletteElement) {
        const rootNode = commandPaletteElement.getRootNode()
        if (rootNode instanceof ShadowRoot) {
          shadowRoot = rootNode
        }
      }
      
      if (!shadowRoot) {
        const shadowHost = document.getElementById('nenspace-modal-container') || 
                          document.querySelector('plasmo-csui[id*="modal"]') as HTMLElement
        if (shadowHost?.shadowRoot) {
          shadowRoot = shadowHost.shadowRoot
        }
      }
      
      if (!shadowRoot) {
        const plasmoElements = document.querySelectorAll('plasmo-csui')
        for (const elem of plasmoElements) {
          if (elem.shadowRoot) {
            const rootNode = commandPaletteElement?.getRootNode()
            if (rootNode === elem.shadowRoot) {
              shadowRoot = elem.shadowRoot
              break
            }
          }
        }
      }
      
      if (!shadowRoot) {
        if (!styleInjectionObserver) {
          styleInjectionObserver = new MutationObserver(() => {
            if (injectStylesDirectly()) {
              if (styleInjectionObserver) {
                styleInjectionObserver.disconnect()
                styleInjectionObserver = null
              }
              if (styleInjectionTimeout) {
                window.clearTimeout(styleInjectionTimeout)
                styleInjectionTimeout = null
              }
            }
          })
          styleInjectionObserver.observe(document.body, { childList: true, subtree: true })
          
          // Add timeout to prevent indefinite observation
          styleInjectionTimeout = window.setTimeout(() => {
            if (styleInjectionObserver) {
              styleInjectionObserver.disconnect()
              styleInjectionObserver = null
              logger.warn('Style injection observer timed out')
            }
          }, 5000)
        }
        return false
      }
      
      if (shadowRoot.querySelector('#command-palette-direct-styles')) {
        if (styleInjectionObserver) {
          styleInjectionObserver.disconnect()
          styleInjectionObserver = null
        }
        if (styleInjectionTimeout) {
          window.clearTimeout(styleInjectionTimeout)
          styleInjectionTimeout = null
        }
        return true
      }
      
      const fullCSS = getCompleteCSUIStyle('modern-dark') + '\n' + 
                    getModalContainerStyles() + '\n' + 
                    getAllChildComponentStyles() + '\n' + 
                    getCommandPaletteStyles()
      
      const style = document.createElement('style')
      style.id = 'command-palette-direct-styles'
      style.textContent = fullCSS
      shadowRoot.insertBefore(style, shadowRoot.firstChild)
      
      if (styleInjectionObserver) {
        styleInjectionObserver.disconnect()
        styleInjectionObserver = null
      }
      if (styleInjectionTimeout) {
        window.clearTimeout(styleInjectionTimeout)
        styleInjectionTimeout = null
      }
      return true
    }
    
    injectStylesDirectly()
    
    inputElement?.focus()
    tabs = await loadTabs()
    globalEscHandler = createEscapeHandler(onClose)
    document.addEventListener('keydown', globalEscHandler, true)
    
    return () => {
      if (styleInjectionObserver) {
        styleInjectionObserver.disconnect()
      }
    }
  })

  onDestroy(() => {
    if (globalEscHandler) {
      document.removeEventListener('keydown', globalEscHandler, true)
      globalEscHandler = null
    }
  })

  function switchMode() {
    currentMode = currentMode === "commands" ? "tabs" : "commands"
    selectedIndex = 0
    searchQuery = ""
    debouncedQuery = ""
  }

  function clearSearch() {
    searchQuery = ""
    debouncedQuery = ""
    selectedIndex = 0
    inputElement?.focus()
  }

  function handleInput(event: Event) {
    event.stopPropagation()
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      if (searchQuery) {
        clearSearch()
      } else {
        onClose()
      }
      return
    }

    event.stopPropagation()

    if (event.shiftKey && event.key === "Tab") {
      event.preventDefault()
      switchMode()
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      selectedIndex = Math.min(selectedIndex + 1, totalResults - 1)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      selectedIndex = Math.max(selectedIndex - 1, 0)
    } else if (event.key === "Enter") {
      event.preventDefault()
      const timerCommand = parseTimerCommand(searchQuery)
      if (timerCommand) {
        executeTimerCommand(timerCommand)
        return
      }
      if (currentMode === "commands") {
        executeCommand(selectedIndex)
      } else {
        switchToTab(selectedIndex)
      }
    }
  }

  function executeCommand(index: number) {
    const command = filteredCommands[index]
    if (!command) return

    if (command.id === "timer-command") {
      const cmd = parseTimerCommand(searchQuery.trim())
      if (cmd) executeTimerCommand(cmd)
      onClose()
    } else if (command.id?.startsWith("slash-")) {
      const commandName = command.id.replace("slash-", "")
      searchQuery = `/${commandName} `
      inputElement?.focus()
      if (inputElement) {
        const length = inputElement.value.length
        inputElement.setSelectionRange(length, length)
      }
      // Don't close for slash commands - they stay open for input
    } else {
      // For commands that open modals, close the command palette first,
      // then execute the action in the next tick to ensure the modal opens
      onClose()
      // Use setTimeout to ensure the command palette closes before opening the new modal
      setTimeout(() => {
        command.action()
      }, 0)
    }
  }

  async function switchToTab(index: number) {
    const tab = filteredTabs[index]
    
    // Validate tab exists and has required properties
    if (!tab) {
      logger.error("Failed to switch tab: No tab at index", { index, filteredTabsLength: filteredTabs.length })
      return
    }
    
    // Explicitly check for id and windowId (using typeof to handle edge cases)
    if (typeof tab.id !== 'number' || tab.id === null || tab.id === undefined) {
      logger.error("Failed to switch tab: Invalid or missing tabId", { tab, tabId: tab.id, tabIdType: typeof tab.id })
      return
    }
    
    if (typeof tab.windowId !== 'number' || tab.windowId === null || tab.windowId === undefined) {
      logger.error("Failed to switch tab: Invalid or missing windowId", { tab, windowId: tab.windowId, windowIdType: typeof tab.windowId })
      return
    }

    try {
      const response = await sendToBackground<
        { tabId: number; windowId: number },
        SwitchTabResponse
      >({
        name: "switch-tab",
        body: { tabId: tab.id, windowId: tab.windowId }
      })

      if (response?.success) {
        onClose()
      } else {
        logger.error("Failed to switch tab", response?.error)
      }
    } catch (error) {
      logger.error("Error switching tab", error)
    }
  }

  function executeTimerCommand(command: TimerCommand): void {
    const timerId = TimerService.startTimer(command.duration, command.label)
    if (timerId) {
      logger.info('Timer started via command palette', { timerId, duration: command.duration, label: command.label })
      onClose()
    } else {
      logger.error('Failed to start timer', { duration: command.duration })
    }
  }
</script>

<div 
  class="backdrop" 
  style="position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; z-index: 2147483646 !important;"
  on:click={onClose} 
  on:keydown={(e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
  }} 
  role="button" 
  tabindex="-1">
  <div class="grid-overlay"></div>
</div>

<div 
  bind:this={commandPaletteElement}
  class="card bg-grid-pattern search-card command-palette" 
  style="position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; z-index: 2147483647 !important;"
  data-modal="command-palette"
  role="searchbox"
  aria-label="Command palette search"
  aria-expanded={showResults}
  aria-haspopup="listbox"
  on:click|stopPropagation>
  <span class="card-corner-bl"></span>
  <span class="card-corner-br"></span>
  
  <div class="search-line">
    <div class="search-icon" aria-hidden="true">
      <IconSearch size={24} color="#ffffff" />
    </div>
    <input
      bind:this={inputElement}
      bind:value={searchQuery}
      on:keydown={handleKeyDown}
      on:input={handleInput}
      type="text"
      class="search-input"
      placeholder="Search commands..."
      autocomplete="off"
      spellcheck="false"
      aria-label="Search commands and tabs"
      aria-describedby="search-hint"
      aria-activedescendant={showResults && selectedIndex >= 0 ? `result-${selectedIndex}` : undefined} />
    {#if searchQuery}
      <button 
        class="clear-btn" 
        on:click={clearSearch} 
        aria-label="Clear search">
        <IconClose size={20} color="var(--nenspace-text-muted)" />
      </button>
    {/if}
  </div>

  <div id="search-hint" class="hint-text">
    <KeyIcon key="ArrowUp" />
    <KeyIcon key="ArrowDown" />
    <span>navigate</span>
    <span class="separator">•</span>
    <KeyIcon key="Enter" />
    <span>select</span>
    <span class="separator">•</span>
    <KeyIcon key="Shift" />
    <KeyIcon key="Tab" />
    <span>switch mode</span>
    <span class="separator">•</span>
    <KeyIcon key="Escape" />
    <span>close</span>
  </div>
</div>

<div 
  class="status-bar-card card bg-grid-pattern">
  <span class="status-bar-corner-tl"></span>
  <span class="status-bar-corner-tr"></span>
  <span class="status-bar-corner-bl"></span>
  <span class="status-bar-corner-br"></span>
  
  <div class="mode-indicator mode-{currentMode}">
    <div class="mode-dot"></div>
    <span class="mode-label">
      {currentMode === "commands" ? "Commands" : "Open Tabs"}
    </span>
    <span class="mode-count">
      {currentMode === "commands" ? commands.length : tabs.length} items
    </span>
  </div>
</div>

{#if showResults}
  <div
    class="card bg-grid-pattern results-card mode-{currentMode} rounded-lg shadow-sm"
    style="position: fixed !important; top: calc(50% + 140px) !important; left: 50% !important; transform: translateX(-50%) !important; z-index: 2147483647 !important;"
    role="listbox"
    aria-label={`${currentMode === "commands" ? "Commands" : "Open tabs"} search results`}
    in:scale={{ duration: 250, easing: quintOut, start: 0.95 }}>
    <span class="card-corner-bl"></span>
    <span class="card-corner-br"></span>
    {#if currentMode === "commands"}
      {#if filteredCommands.length > 0}
        <div class="commands-list">
          {#each filteredCommands as command, index (command.id)}
            <button
              id="result-{index}"
              class="command-item"
              class:selected={index === selectedIndex}
              role="option"
              aria-selected={index === selectedIndex}
              aria-label="{command.label}: {command.description}"
              on:click={() => executeCommand(index)}
              on:mouseenter={() => (selectedIndex = index)}>
              {#if command.icon}
                <div
                  class="command-icon"
                  aria-hidden="true"
                  style="color: var(--nenspace-accent-{index % 2 === 0 ? 'primary' : 'secondary'})">
                  <svelte:component this={command.icon} size={20} />
                </div>
              {/if}
              <div class="command-info">
                <div class="command-label">
                  {@html highlightMatches(command.label, queryTerms)}
                </div>
                <div class="command-description">
                  {@html highlightMatches(command.description, queryTerms)}
                </div>
              </div>
              {#if command.shortcut}
                <div class="command-shortcut" aria-label="Keyboard shortcut: {command.shortcut}">{command.shortcut}</div>
              {/if}
            </button>
          {/each}
        </div>
      {:else}
        <div class="empty-state" role="status" aria-live="polite">
          <p>No commands found</p>
          <small>Try a different search term</small>
        </div>
      {/if}
    {:else if filteredTabs.length > 0}
      <div class="commands-list">
        {#each filteredTabs as tab, index (tab.id)}
          <button
            id="result-{index}"
            class="command-item tab-item"
            class:selected={index === selectedIndex}
            role="option"
            aria-selected={index === selectedIndex}
            aria-label="Switch to tab: {tab.title}"
            on:click={() => switchToTab(index)}
            on:mouseenter={() => (selectedIndex = index)}>
            {#if tab.favIconUrl}
              <img src={tab.favIconUrl} alt="" class="tab-favicon" />
            {:else}
              <div class="tab-favicon-placeholder" aria-hidden="true">🌐</div>
            {/if}
            <div class="command-info">
              <div class="command-label">
                {@html highlightMatches(tab.title, queryTerms)}
              </div>
              <div class="command-description">
                {@html highlightMatches(tab.url, queryTerms)}
              </div>
            </div>
          </button>
        {/each}
      </div>
    {:else}
      <div class="empty-state" role="status" aria-live="polite">
        <p>No tabs found</p>
        <small>Try a different search term</small>
      </div>
    {/if}
  </div>
{/if}

<!-- 
  CRITICAL: NO <style> tags in CSUI components!
  All styles are injected via getStyle API into Shadow DOM ONLY.
  This prevents CSS from leaking to the page.
  
  Styles are defined in: src/lib/utils/command-palette-styles.util.ts
  Injected via: src/contents/command-palette.tsx getStyle API
-->

<style>
  /* All styles moved to getStyle API - see command-palette-styles.util.ts */
  /* NO CSS HERE - prevents leaking to page */
</style>
<!-- All styles moved to getStyle API - see command-palette-styles.util.ts -->

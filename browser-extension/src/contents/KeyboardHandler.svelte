<script lang="ts">
  import { onMount, onDestroy } from "svelte"
  import { get } from "svelte/store"
  import { modalStore } from "../lib/stores/modal.store"
  import { shortcutsStore } from "../lib/stores/shortcuts.store"
  import { createLogger } from "../lib/utils/logger.util"
  import { shortcutsHandler } from "../lib/utils/shortcuts-handler.util"
  import HelpDialog from "../lib/components/HelpDialog.svelte"
  import { isBlocklistedBrowserShortcut, getShortcutsConfigSummary } from "../lib/config/shortcuts.config"

  const logger = createLogger("[KeyboardHandler]")

  let unregisterKeyboard: (() => void) | null = null
  let showHelp = false
  
  let lastCmdPressTime: number | null = null
  let doubleCmdTimeout: ReturnType<typeof setTimeout> | null = null
  const DOUBLE_CMD_TIME_WINDOW = 400

  function matchesKeys(event: KeyboardEvent, keys: string[]): boolean {
    if (keys.length === 0) return false

    const hasMeta = keys.includes("Meta") || keys.includes("Cmd")
    const hasControl = keys.includes("Control") || keys.includes("Ctrl")
    const hasAlt = keys.includes("Alt")
    const hasShift = keys.includes("Shift")

    if (event.metaKey && !hasMeta) return false
    if (event.ctrlKey && !hasMeta && !hasControl) return false
    if (event.altKey && !hasAlt) return false
    if (event.shiftKey && !hasShift) return false

    if (hasMeta) {
      if (!event.metaKey && !event.ctrlKey) return false
      if (hasControl) return false
    }
    if (hasControl && !hasMeta) {
      if (!event.ctrlKey || event.metaKey) return false
    }
    if (hasAlt && !event.altKey) return false
    if (hasShift && !event.shiftKey) return false

    const actualKey = keys.find(
      (key) => !["Meta", "Control", "Alt", "Shift", "Cmd", "Ctrl"].includes(key)
    )

    if (!actualKey) return false

    const eventKey = actualKey === "K" ? event.key : event.key.toLowerCase()
    const matchKey = actualKey === "K" ? actualKey : actualKey.toLowerCase()
    
    return eventKey === matchKey
  }

  onMount(async () => {
    await shortcutsStore.init()

    shortcutsHandler.setEnabled(true)
    shortcutsHandler.setHelpDialog({
      show: () => {
        showHelp = true
      }
    })

    const shortcuts = get(shortcutsStore)
    const configSummary = getShortcutsConfigSummary()
    logger.info("Keyboard shortcuts initialized", {
      totalShortcuts: shortcuts.length,
      enabledShortcuts: shortcuts.filter(s => s.enabled).length,
      blocklistedBrowserShortcuts: configSummary.blocklistedShortcuts,
      shortcuts: shortcuts.map((s) => ({
        id: s.id,
        enabled: s.enabled,
        keys: s.userKeys || s.defaultKeys,
        label: s.label
      }))
    })
    
    logger.debug("Blocklisted browser shortcuts:", configSummary.blocklistedShortcutsList)

    const commandPaletteShortcut = shortcuts.find(
      (s) => s.id === "command-palette"
    )
    if (commandPaletteShortcut) {
      logger.info("Command palette shortcut registered", {
        enabled: commandPaletteShortcut.enabled,
        keys:
          commandPaletteShortcut.userKeys || commandPaletteShortcut.defaultKeys,
        label: commandPaletteShortcut.label
      })
    } else {
      logger.warn("Command palette shortcut not found!")
    }
    
    logger.info("Keyboard handler ready - listening for shortcuts")

    const handleKeyDown = (event: KeyboardEvent) => {
      const isCmdShiftK = 
        (event.metaKey || event.ctrlKey) && 
        event.shiftKey && 
        (event.key === "k" || event.key === "K")
      
      if (isCmdShiftK && !isCommandPaletteOpen()) {
        logger.info("CMD+Shift+K detected, opening command palette", {
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          key: event.key,
          target: (event.target as HTMLElement)?.tagName
        })
        event.preventDefault()
        event.stopPropagation()
        
        const position = {
          x: window.innerWidth / 2,
          y: window.innerHeight / 3
        }
        
        modalStore.toggleCommandPalette(position)
        return
      } else if (isCmdShiftK) {
        return
      }
      
      const hasCmd = event.metaKey || event.ctrlKey
      
      if (hasCmd || event.key === "Meta" || event.key === "Control") {
        logger.info("[DOUBLE CMD CHECK] Event received", {
          key: event.key,
          code: (event as any).code,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          hasCmd
        })
      }
      const isModifierKey = event.key === "Meta" || 
                            event.key === "Control" || 
                            event.key === "Cmd" || 
                            event.key === "OSLeft" || 
                            event.key === "OSRight" ||
                            event.key === "MetaLeft" ||
                            event.key === "MetaRight" ||
                            event.key === "ControlLeft" ||
                            event.key === "ControlRight"
      
      const isCmdOnly = hasCmd && 
                        !event.shiftKey && 
                        !event.altKey &&
                        isModifierKey
      
      if (hasCmd) {
        logger.info("CMD-related event", {
          key: event.key,
          code: (event as any).code,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          isModifierKey,
          isCmdOnly,
          lastCmdPressTime,
          timeSinceLastPress: lastCmdPressTime ? Date.now() - lastCmdPressTime : null,
          hasPendingTimeout: doubleCmdTimeout !== null
        })
      }
      
      if (isCmdOnly) {
        const now = Date.now()
        const timeSinceLastPress = lastCmdPressTime !== null ? now - lastCmdPressTime : null
        
        if (lastCmdPressTime !== null && timeSinceLastPress !== null && timeSinceLastPress < DOUBLE_CMD_TIME_WINDOW) {
          logger.info("DOUBLE CMD PRESS DETECTED!", {
            timeSinceLastPress,
            window: DOUBLE_CMD_TIME_WINDOW,
            withinWindow: timeSinceLastPress < DOUBLE_CMD_TIME_WINDOW
          })
          
          if (doubleCmdTimeout) {
            clearTimeout(doubleCmdTimeout)
            doubleCmdTimeout = null
          }
          
          lastCmdPressTime = null
          
          if (!isCommandPaletteOpen()) {
            logger.info("Opening command palette via double CMD", {
              timeSinceLastPress,
              window: DOUBLE_CMD_TIME_WINDOW
            })
            
            event.preventDefault()
            event.stopPropagation()
            
            const position = {
              x: window.innerWidth / 2,
              y: window.innerHeight / 3
            }
            
            modalStore.toggleCommandPalette(position)
          }
          
          return
        } else {
          lastCmdPressTime = now
          
          if (doubleCmdTimeout) {
            clearTimeout(doubleCmdTimeout)
          }
          
          doubleCmdTimeout = setTimeout(() => {
            lastCmdPressTime = null
            doubleCmdTimeout = null
          }, DOUBLE_CMD_TIME_WINDOW)
          
          return
        }
      } else {
        const isRegularKey = event.key.length === 1 || 
                             (event.key !== "Meta" && event.key !== "Control" && event.key !== "Cmd" && 
                              event.key !== "OSLeft" && event.key !== "OSRight" &&
                              event.key !== "Shift" && event.key !== "Alt")
        
        if (isRegularKey && (lastCmdPressTime !== null || doubleCmdTimeout !== null)) {
          if (doubleCmdTimeout) {
            clearTimeout(doubleCmdTimeout)
            doubleCmdTimeout = null
          }
          lastCmdPressTime = null
        }
      }

      if (isBlocklistedBrowserShortcut(event)) {
        return
      }

      const target = event.target as HTMLElement

      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest("input") ||
        target.closest("textarea") ||
        target.closest('[contenteditable="true"]') ||
        target.closest('[contenteditable=""]')

      const isInModal =
        target.closest(".modal-container") ||
        target.closest(".command-palette") ||
        target.closest(".floating-modal") ||
        target.closest("[data-modal]")

      if ((isInputField || isInModal) && event.key !== "Escape") {
        return
      }

      if (target.closest("form") && event.key !== "Escape") {
        return
      }

      if (isCommandPaletteOpen()) {
        return
      }

      const shortcuts = get(shortcutsStore)

      for (const shortcut of shortcuts) {
        if (!shortcut.enabled) {
          continue
        }

        const keys = shortcut.userKeys || shortcut.defaultKeys
        if (!keys || keys.length === 0) {
          continue
        }

        if (matchesKeys(event, keys)) {
          event.preventDefault()
          event.stopPropagation()
          
          if (shortcut.id === "command-palette" && isCommandPaletteOpen()) {
            return
          }

          const position = {
            x: window.innerWidth / 2,
            y: window.innerHeight / 3
          }

          switch (shortcut.id) {
            case "command-palette":
              modalStore.toggleCommandPalette(position)
              break
            case "add-bookmark":
              modalStore.openModal("bookmark", position)
              break
            case "open-settings":
              modalStore.openModal("settings")
              break
            case "open-home":
              modalStore.openModal("home")
              break
          }

          return
        }
      }

      const helpDialogOpen = document.querySelector('.help-dialog') !== null
      if (helpDialogOpen && event.key === "Escape") {
        return
      }

      const shortcutsHandled = shortcutsHandler.handleKeyDown(event)
      if (shortcutsHandled) {
        event.preventDefault()
        event.stopPropagation()
        return
      }

      if (event.key === "Escape") {
        const modalState = get(modalStore)
        if (modalState.activeModal) {
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown, true)
    unregisterKeyboard = () =>
      document.removeEventListener("keydown", handleKeyDown, true)
  })

  onDestroy(() => {
    if (unregisterKeyboard) {
      unregisterKeyboard()
    }
    shortcutsHandler.destroy()
    
    if (doubleCmdTimeout) {
      clearTimeout(doubleCmdTimeout)
      doubleCmdTimeout = null
    }
    lastCmdPressTime = null
  })

  function closeHelp() {
    showHelp = false
  }

  function isCommandPaletteOpen(): boolean {
    const modalState = get(modalStore)
    return modalState.activeModal === "command-palette"
  }
</script>

{#if showHelp}
  <HelpDialog onClose={closeHelp} />
{/if}

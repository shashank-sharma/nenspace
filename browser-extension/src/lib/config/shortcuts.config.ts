/**
 * Keyboard Shortcuts Configuration
 * 
 * This file centralizes all keyboard shortcut configurations:
 * - Browser shortcuts blocklist (shortcuts that should NOT be intercepted)
 * - Default extension shortcuts
 * 
 * To modify shortcuts, edit the configurations below.
 */

export interface BrowserShortcutDefinition {
  /** Key code (e.g., "r", "R", "w") */
  key: string | string[]
  /** Whether Meta/Cmd key is required */
  meta?: boolean
  /** Whether Ctrl key is required */
  ctrl?: boolean
  /** Whether Shift key is required */
  shift?: boolean
  /** Whether Alt key is required */
  alt?: boolean
  /** Description of what this shortcut does */
  description: string
}

/**
 * Browser shortcuts that should NOT be intercepted by the extension.
 * These shortcuts will always be allowed to execute their default browser behavior.
 * 
 * To add a new blocklisted shortcut:
 * 1. Add an entry to the array below
 * 2. The shortcut will automatically be checked in KeyboardHandler and ShortcutsHandler
 * 
 * Examples:
 * - { key: "r", meta: true, description: "Refresh page (CMD+R)" }
 * - { key: "R", meta: true, shift: true, description: "Hard refresh (CMD+Shift+R)" }
 * - { key: "w", meta: true, description: "Close tab (CMD+W)" }
 */
export const BLOCKLISTED_BROWSER_SHORTCUTS: BrowserShortcutDefinition[] = [
  // Refresh shortcuts
  {
    key: ["r", "R"],
    meta: true,
    description: "Refresh page (CMD+R / CMD+Shift+R)"
  },
  {
    key: ["r", "R"],
    ctrl: true,
    description: "Refresh page (CTRL+R / CTRL+Shift+R)"
  },
  
  // Tab management
  {
    key: "w",
    meta: true,
    description: "Close tab (CMD+W)"
  },
  {
    key: "w",
    ctrl: true,
    description: "Close tab (CTRL+W)"
  },
  {
    key: "t",
    meta: true,
    description: "New tab (CMD+T)"
  },
  {
    key: "t",
    ctrl: true,
    description: "New tab (CTRL+T)"
  },
  {
    key: "T",
    meta: true,
    shift: true,
    description: "Restore closed tab (CMD+Shift+T)"
  },
  {
    key: "T",
    ctrl: true,
    shift: true,
    description: "Restore closed tab (CTRL+Shift+T)"
  },
  
  // Window management
  {
    key: "n",
    meta: true,
    description: "New window (CMD+N)"
  },
  {
    key: "n",
    ctrl: true,
    description: "New window (CTRL+N)"
  },
  {
    key: "q",
    meta: true,
    description: "Quit application (CMD+Q)"
  },
  {
    key: "q",
    ctrl: true,
    description: "Quit application (CTRL+Q)"
  },
]

/**
 * Check if a keyboard event matches any blocklisted browser shortcut.
 * 
 * @param event - The keyboard event to check
 * @returns true if the event matches a blocklisted shortcut (should be allowed through)
 */
export function isBlocklistedBrowserShortcut(event: KeyboardEvent): boolean {
  for (const shortcut of BLOCKLISTED_BROWSER_SHORTCUTS) {
    const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key]
    const keyMatches = keys.includes(event.key) || keys.includes(event.key.toLowerCase())
    
    if (!keyMatches) continue
    
    // Check modifier requirements
    if (shortcut.meta !== undefined) {
      // Meta/Cmd: on Mac it's metaKey, on Windows/Linux it might be ctrlKey for CMD
      if (shortcut.meta && !event.metaKey && !event.ctrlKey) continue
      if (!shortcut.meta && (event.metaKey || event.ctrlKey)) continue
    }
    
    if (shortcut.ctrl !== undefined) {
      if (shortcut.ctrl && !event.ctrlKey) continue
      if (!shortcut.ctrl && event.ctrlKey) continue
    }
    
    if (shortcut.shift !== undefined) {
      if (shortcut.shift && !event.shiftKey) continue
      if (!shortcut.shift && event.shiftKey) continue
    }
    
    if (shortcut.alt !== undefined) {
      if (shortcut.alt && !event.altKey) continue
      if (!shortcut.alt && event.altKey) continue
    }
    
    // If we get here, all requirements match
    return true
  }
  
  return false
}

/**
 * Extension default shortcuts configuration.
 * 
 * To modify default shortcuts, edit the SHORTCUTS_DEFAULTS array in shortcuts.store.ts
 * which imports from this file.
 * 
 * Format:
 * - id: Unique identifier for the shortcut
 * - label: Display name
 * - description: What the shortcut does
 * - defaultKeys: Array of key names (e.g., ['Meta', 'Shift', 'K'] for CMD+Shift+K)
 * - enabled: Whether the shortcut is enabled by default
 */
export interface ShortcutDefaultsConfig {
  id: string
  label: string
  description: string
  defaultKeys: string[] | null
  enabled: boolean
}

/**
 * Export a summary of all configurations for debugging/logging
 */
export function getShortcutsConfigSummary() {
  return {
    blocklistedShortcuts: BLOCKLISTED_BROWSER_SHORTCUTS.length,
    blocklistedShortcutsList: BLOCKLISTED_BROWSER_SHORTCUTS.map(s => ({
      keys: Array.isArray(s.key) ? s.key.join('/') : s.key,
      modifiers: {
        meta: s.meta ?? false,
        ctrl: s.ctrl ?? false,
        shift: s.shift ?? false,
        alt: s.alt ?? false
      },
      description: s.description
    }))
  }
}


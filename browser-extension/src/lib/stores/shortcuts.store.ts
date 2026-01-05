import { writable, get } from 'svelte/store'
import { storage } from '../services/plasmo-storage.service'

export interface ShortcutConfig {
  id: string
  label: string
  description: string
  defaultKeys: string[] | null
  userKeys: string[] | null
  enabled: boolean
}

const STORAGE_KEY = 'nenspace_shortcuts'

const defaultShortcuts: ShortcutConfig[] = [
  {
    id: 'command-palette',
    label: 'Open Command Palette',
    description: 'Quick access to all commands',
    defaultKeys: ['Meta', 'Shift', 'K'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'add-bookmark',
    label: 'Add Bookmark',
    description: 'Save current page as bookmark',
    defaultKeys: null,
    userKeys: null,
    enabled: false
  },
  {
    id: 'open-settings',
    label: 'Open Settings',
    description: 'Access settings panel',
    defaultKeys: null,
    userKeys: null,
    enabled: false
  },
  {
    id: 'open-home',
    label: 'Open Home',
    description: 'Access home dashboard',
    defaultKeys: null,
    userKeys: null,
    enabled: false
  },
  // Keyboard shortcuts
  {
    id: 'shortcuts-help',
    label: 'Show Help',
    description: 'Show keyboard shortcuts',
    defaultKeys: ['?'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-find',
    label: 'Find Mode',
    description: 'Enter find mode to search text',
    defaultKeys: ['/'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-scroll-up',
    label: 'Scroll Up',
    description: 'Scroll up by one step',
    defaultKeys: ['k'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-scroll-down',
    label: 'Scroll Down',
    description: 'Scroll down by one step',
    defaultKeys: ['j'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-scroll-left',
    label: 'Scroll Left',
    description: 'Scroll left by one step',
    defaultKeys: ['h'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-scroll-right',
    label: 'Scroll Right',
    description: 'Scroll right by one step',
    defaultKeys: ['l'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-scroll-top',
    label: 'Scroll to Top',
    description: 'Scroll to the top of the page',
    defaultKeys: ['g', 'g'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-scroll-bottom',
    label: 'Scroll to Bottom',
    description: 'Scroll to the bottom of the page',
    defaultKeys: ['G'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-scroll-page-up',
    label: 'Scroll Page Up',
    description: 'Scroll up by half a page',
    defaultKeys: ['u'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-scroll-page-down',
    label: 'Scroll Page Down',
    description: 'Scroll down by half a page',
    defaultKeys: ['d'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-find-next',
    label: 'Find Next',
    description: 'Go to next search result',
    defaultKeys: ['n'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-find-prev',
    label: 'Find Previous',
    description: 'Go to previous search result',
    defaultKeys: ['N'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-back',
    label: 'Go Back',
    description: 'Navigate back in history',
    defaultKeys: ['H'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-forward',
    label: 'Go Forward',
    description: 'Navigate forward in history',
    defaultKeys: ['L'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-prev-tab',
    label: 'Previous Tab',
    description: 'Switch to previous tab',
    defaultKeys: ['J'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-next-tab',
    label: 'Next Tab',
    description: 'Switch to next tab',
    defaultKeys: ['K'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-new-tab',
    label: 'New Tab',
    description: 'Open a new tab',
    defaultKeys: ['t'],
    userKeys: null,
    enabled: false
  },
  {
    id: 'shortcuts-close-tab',
    label: 'Close Tab',
    description: 'Close current tab',
    defaultKeys: ['x'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-restore-tab',
    label: 'Restore Tab',
    description: 'Restore last closed tab',
    defaultKeys: ['X'],
    userKeys: null,
    enabled: true
  },
  {
    id: 'shortcuts-reload',
    label: 'Reload Page',
    description: 'Reload the current page',
    defaultKeys: ['r'],
    userKeys: null,
    enabled: false // Disabled to allow browser CMD+R / CTRL+R to work
  }
]

function createShortcutsStore() {
  const { subscribe, set, update } = writable<ShortcutConfig[]>(defaultShortcuts)

  return {
    subscribe,
    
    async init() {
      try {
        const result = await storage.get(STORAGE_KEY)
        if (result) {
          set(result as ShortcutConfig[])
        }
      } catch (error) {
        console.error('[Shortcuts] Failed to load:', error)
      }
    },
    
    async updateShortcut(id: string, keys: string[] | null) {
      update(shortcuts => {
        const updated = shortcuts.map(shortcut => {
          if (shortcut.id === id) {
            return {
              ...shortcut,
              userKeys: keys,
              enabled: keys !== null && keys.length > 0
            }
          }
          return shortcut
        })
        
        // Save to storage
        storage.set(STORAGE_KEY, updated)
        
        return updated
      })
    },
    
    async resetShortcut(id: string) {
      update(shortcuts => {
        const updated = shortcuts.map(shortcut => {
          if (shortcut.id === id) {
            return {
              ...shortcut,
              userKeys: null,
              enabled: shortcut.defaultKeys !== null
            }
          }
          return shortcut
        })
        
        storage.set(STORAGE_KEY, updated)
        
        return updated
      })
    },
    
    getActiveKeys(id: string): string[] | null {
      const shortcuts = get(this)
      const shortcut = shortcuts.find(s => s.id === id)
      return (shortcut?.enabled) ? (shortcut.userKeys || shortcut.defaultKeys) : null
    }
  }
}

export const shortcutsStore = createShortcutsStore()


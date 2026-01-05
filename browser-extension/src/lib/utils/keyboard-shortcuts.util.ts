export interface Shortcut {
  key: string
  modifiers: Array<'cmd' | 'ctrl' | 'shift' | 'alt'>
  description?: string
}

export const SHORTCUTS = {
  COMMAND_PALETTE: { 
    key: 'k', 
    modifiers: ['cmd', 'shift'] as Array<'cmd' | 'shift'>,
    description: 'Open command palette'
  },
  SETTINGS: { 
    key: ',', 
    modifiers: ['cmd'] as Array<'cmd'>,
    description: 'Open settings'
  },
  ADD_BOOKMARK: { 
    key: 'd', 
    modifiers: ['cmd'] as Array<'cmd'>,
    description: 'Add bookmark'
  },
  CLOSE: {
    key: 'Escape',
    modifiers: [] as Array<never>,
    description: 'Close modal'
  }
} as const

/**
 * Detect if the platform is Mac
 */
function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
}

/**
 * Check if the keyboard event matches a shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  const key = event.key.toLowerCase()
  const shortcutKey = shortcut.key.toLowerCase()
  
  if (key !== shortcutKey) return false
  
  const isMac = isMacPlatform()
  
  for (const modifier of shortcut.modifiers) {
    if (modifier === 'cmd') {
      if (isMac && !event.metaKey) return false
      if (!isMac && !event.ctrlKey) return false
    } else if (modifier === 'ctrl') {
      if (!event.ctrlKey) return false
    } else if (modifier === 'shift') {
      if (!event.shiftKey) return false
    } else if (modifier === 'alt') {
      if (!event.altKey) return false
    }
  }
  
  // Ensure no extra modifiers
  const hasCmd = isMac ? event.metaKey : event.ctrlKey
  const expectedCmd = shortcut.modifiers.includes('cmd')
  const expectedCtrl = shortcut.modifiers.includes('ctrl')
  const expectedShift = shortcut.modifiers.includes('shift')
  const expectedAlt = shortcut.modifiers.includes('alt')
  
  if (hasCmd !== expectedCmd && !expectedCtrl) return false
  if (event.shiftKey !== expectedShift) return false
  if (event.altKey !== expectedAlt) return false
  
  return true
}

/**
 * Format shortcut for display (e.g., "⌘⇧K")
 */
export function formatShortcutDisplay(shortcut: Shortcut): string {
  const isMac = isMacPlatform()
  
  const symbols: Record<string, string> = isMac
    ? { cmd: '⌘', ctrl: '⌃', shift: '⇧', alt: '⌥' }
    : { cmd: 'Ctrl', ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt' }
  
  const modifierParts = shortcut.modifiers.map(mod => symbols[mod] || mod)
  const keyPart = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key
  
  return [...modifierParts, keyPart].join(isMac ? '' : '+')
}

/**
 * Register global keyboard shortcuts
 */
export function registerGlobalShortcuts(
  handlers: Record<string, (event: KeyboardEvent) => void>
): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Skip if user is typing in an input
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow ESC even in inputs
      if (event.key !== 'Escape') return
    }
    
    for (const [name, handler] of Object.entries(handlers)) {
      const shortcut = SHORTCUTS[name as keyof typeof SHORTCUTS]
      if (shortcut && matchesShortcut(event, shortcut)) {
        event.preventDefault()
        handler(event)
        break
      }
    }
  }
  
  document.addEventListener('keydown', handleKeyDown)
  
  return () => {
    document.removeEventListener('keydown', handleKeyDown)
  }
}


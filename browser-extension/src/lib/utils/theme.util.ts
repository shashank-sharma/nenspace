import { THEMES } from '../config/constants'

export interface ThemeColors {
  modalBg: string
  modalText: string
  modalBorder: string
  overlayBg: string
  inputBg: string
  inputBorder: string
  inputText: string
  accentPrimary: string
  accentSecondary: string
  textSecondary: string
  divider: string
  hoverBg: string
}

/**
 * Get the effective theme based on saved preference and system preference
 */
export function getEffectiveTheme(savedTheme: string): 'light' | 'dark' {
  if (savedTheme === THEMES.LIGHT) return 'light'
  if (savedTheme === THEMES.DARK) return 'dark'
  
  // Auto mode - check system preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  
  return 'light'
}

/**
 * Apply theme data attribute to an element
 */
export function applyThemeToElement(element: HTMLElement, theme: string): void {
  const effectiveTheme = getEffectiveTheme(theme)
  element.setAttribute('data-theme', effectiveTheme)
}

/**
 * Get theme-specific color values
 */
export function getThemeColors(theme: 'light' | 'dark'): ThemeColors {
  if (theme === 'dark') {
    return {
      modalBg: 'rgba(30, 30, 30, 0.98)',
      modalText: '#f3f4f6',
      modalBorder: 'rgba(255, 255, 255, 0.12)',
      overlayBg: 'rgba(0, 0, 0, 0.6)',
      inputBg: 'rgba(255, 255, 255, 0.08)',
      inputBorder: 'rgba(255, 255, 255, 0.12)',
      inputText: '#f3f4f6',
      accentPrimary: '#6366f1',
      accentSecondary: '#8b5cf6',
      textSecondary: '#9ca3af',
      divider: 'rgba(255, 255, 255, 0.1)',
      hoverBg: 'rgba(255, 255, 255, 0.1)'
    }
  }
  
  return {
    modalBg: 'rgba(255, 255, 255, 0.98)',
    modalText: '#1f2937',
    modalBorder: 'rgba(0, 0, 0, 0.08)',
    overlayBg: 'rgba(0, 0, 0, 0.4)',
    inputBg: '#ffffff',
    inputBorder: 'rgba(0, 0, 0, 0.12)',
    inputText: '#1f2937',
    accentPrimary: '#6366f1',
    accentSecondary: '#8b5cf6',
    textSecondary: '#6b7280',
    divider: 'rgba(0, 0, 0, 0.08)',
    hoverBg: 'rgba(99, 102, 241, 0.08)'
  }
}

/**
 * Listen for system theme changes
 */
export function watchSystemTheme(callback: (theme: 'light' | 'dark') => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {}
  }
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light')
  }
  
  mediaQuery.addEventListener('change', handler)
  
  return () => {
    mediaQuery.removeEventListener('change', handler)
  }
}


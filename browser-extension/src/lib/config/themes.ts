export interface ThemeConfig {
  id: string
  name: string
  // HSL values for CSS variables (without hsl() wrapper)
  cssVariables: {
    background: string
    foreground: string
    card: string
    'card-foreground': string
    popover: string
    'popover-foreground': string
    primary: string
    'primary-foreground': string
    secondary: string
    'secondary-foreground': string
    muted: string
    'muted-foreground': string
    accent: string
    'accent-foreground': string
    destructive: string
    'destructive-foreground': string
    border: string
    input: string
    ring: string
    radius: string
  }
}

export const THEME_CONFIGS: Record<string, ThemeConfig> = {
  'modern-dark': {
    id: 'modern-dark',
    name: 'Modern Dark',
    cssVariables: {
      background: '222.2 84% 4.9%',
      foreground: '210 40% 98%',
      card: '222.2 84% 4.9%',
      'card-foreground': '210 40% 98%',
      popover: '222.2 84% 4.9%',
      'popover-foreground': '210 40% 98%',
      primary: '5 100% 69%',
      'primary-foreground': '0 0% 100%',
      secondary: '217.2 32.6% 17.5%',
      'secondary-foreground': '210 40% 98%',
      muted: '217.2 32.6% 17.5%',
      'muted-foreground': '215 20.2% 65.1%',
      accent: '217.2 32.6% 17.5%',
      'accent-foreground': '210 40% 98%',
      destructive: '0 62.8% 30.6%',
      'destructive-foreground': '210 40% 98%',
      border: '217.2 32.6% 17.5%',
      input: '217.2 32.6% 17.5%',
      ring: '212.7 26.8% 83.9%',
      radius: '0.5rem'
    }
  },
  'light': {
    id: 'light',
    name: 'Light',
    cssVariables: {
      background: '0 0% 100%',
      foreground: '222.2 84% 4.9%',
      card: '0 0% 100%',
      'card-foreground': '222.2 84% 4.9%',
      popover: '0 0% 100%',
      'popover-foreground': '222.2 84% 4.9%',
      primary: '5 100% 69%',
      'primary-foreground': '0 0% 100%',
      secondary: '210 40% 96.1%',
      'secondary-foreground': '222.2 47.4% 11.2%',
      muted: '210 40% 96.1%',
      'muted-foreground': '215.4 16.3% 46.9%',
      accent: '210 40% 96.1%',
      'accent-foreground': '222.2 47.4% 11.2%',
      destructive: '0 84.2% 60.2%',
      'destructive-foreground': '210 40% 98%',
      border: '214.3 31.8% 91.4%',
      input: '214.3 31.8% 91.4%',
      ring: '222.2 84% 4.9%',
      radius: '0.5rem'
    }
  },
  'dark': {
    id: 'dark',
    name: 'Dark',
    cssVariables: {
      background: '222.2 84% 4.9%',
      foreground: '210 40% 98%',
      card: '222.2 84% 4.9%',
      'card-foreground': '210 40% 98%',
      popover: '222.2 84% 4.9%',
      'popover-foreground': '210 40% 98%',
      primary: '210 40% 98%',
      'primary-foreground': '222.2 47.4% 11.2%',
      secondary: '217.2 32.6% 17.5%',
      'secondary-foreground': '210 40% 98%',
      muted: '217.2 32.6% 17.5%',
      'muted-foreground': '215 20.2% 65.1%',
      accent: '217.2 32.6% 17.5%',
      'accent-foreground': '210 40% 98%',
      destructive: '0 62.8% 30.6%',
      'destructive-foreground': '210 40% 98%',
      border: '217.2 32.6% 17.5%',
      input: '217.2 32.6% 17.5%',
      ring: '212.7 26.8% 83.9%',
      radius: '0.5rem'
    }
  }
}

export const EXTENDED_VARIABLES = {
  'overlay-bg': 'rgba(0, 0, 0, 0.7)',
  'text-primary': '#ffffff',
  'text-secondary': '#e5e7eb',
  'text-muted': '#9ca3af',
  'accent-primary': '#e88b8b',
  'accent-secondary': '#b4c96c',
  'accent-tertiary': '#3b82f6',
  'card-background': '#2a2d31',
  'input-bg': 'rgba(255, 255, 255, 0.05)',
  'hover-bg': 'rgba(255, 255, 255, 0.1)',
  'divider': 'rgba(255, 255, 255, 0.08)'
}

export function getThemeConfig(themeId: string): ThemeConfig {
  return THEME_CONFIGS[themeId] || THEME_CONFIGS['modern-dark']
}

/**
 * Apply theme to an element by setting CSS variables
 * Uses HSL format to match frontend styling
 * Uses namespaced variables (--nenspace-*) to avoid conflicts with page CSS
 */
export function applyThemeToElement(element: HTMLElement, themeId: string): void {
  const config = getThemeConfig(themeId)
  
  // Apply CSS variables with nenspace prefix to avoid conflicts with page CSS
  Object.entries(config.cssVariables).forEach(([key, value]) => {
    element.style.setProperty(`--nenspace-${key}`, value)
  })
  
  // Also apply extended variables for modals and other components
  Object.entries(EXTENDED_VARIABLES).forEach(([key, value]) => {
    element.style.setProperty(`--nenspace-${key}`, value)
  })
}

/**
 * CSS Variable Migration Helper
 * 
 * Maps old variable names to new namespaced names for migration reference
 */

export const CSS_VARIABLE_MAP: Record<string, string> = {
  // Core colors
  '--background': '--nenspace-background',
  '--foreground': '--nenspace-foreground',
  '--card': '--nenspace-card',
  '--card-foreground': '--nenspace-card-foreground',
  '--popover': '--nenspace-popover',
  '--popover-foreground': '--nenspace-popover-foreground',
  
  // Semantic colors
  '--primary': '--nenspace-primary',
  '--primary-foreground': '--nenspace-primary-foreground',
  '--secondary': '--nenspace-secondary',
  '--secondary-foreground': '--nenspace-secondary-foreground',
  '--muted': '--nenspace-muted',
  '--muted-foreground': '--nenspace-muted-foreground',
  '--accent': '--nenspace-accent',
  '--accent-foreground': '--nenspace-accent-foreground',
  '--destructive': '--nenspace-destructive',
  '--destructive-foreground': '--nenspace-destructive-foreground',
  
  // UI colors
  '--border': '--nenspace-border',
  '--input': '--nenspace-input',
  '--ring': '--nenspace-ring',
  '--radius': '--nenspace-radius',
  
  // Extended colors
  '--overlay-bg': '--nenspace-overlay-bg',
  '--text-primary': '--nenspace-text-primary',
  '--text-secondary': '--nenspace-text-secondary',
  '--text-muted': '--nenspace-text-muted',
  '--accent-primary': '--nenspace-accent-primary',
  '--accent-secondary': '--nenspace-accent-secondary',
  '--accent-tertiary': '--nenspace-accent-tertiary',
  '--card-background': '--nenspace-card-background',
  '--input-bg': '--nenspace-input-bg',
  '--hover-bg': '--nenspace-hover-bg',
  '--divider': '--nenspace-divider',
}

/**
 * Get namespaced variable name from old variable name
 */
export function getNamespacedVariable(oldVar: string): string {
  // Handle var(--variable) format
  if (oldVar.startsWith('var(')) {
    const varName = oldVar.match(/var\(([^)]+)\)/)?.[1]?.trim()
    if (varName) {
      const namespaced = CSS_VARIABLE_MAP[varName] || varName
      return `var(${namespaced})`
    }
  }
  
  // Handle direct variable name
  return CSS_VARIABLE_MAP[oldVar] || oldVar
}

/**
 * Check if a variable needs migration
 */
export function needsMigration(variable: string): boolean {
  if (variable.startsWith('var(')) {
    const varName = variable.match(/var\(([^)]+)\)/)?.[1]?.trim()
    return varName ? varName in CSS_VARIABLE_MAP : false
  }
  return variable in CSS_VARIABLE_MAP
}


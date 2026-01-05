import type { PlasmoGetStyle } from "plasmo"
import { getThemeConfig, EXTENDED_VARIABLES } from "../config/themes"

export function getRootContainerProtectionStyle(): string {
  return `
    #plasmo-shadow-container {
      display: contents !important;
      position: static !important;
      contain: none !important;
      transform: none !important;
    }
    
    #plasmo-inline {
      display: contents !important;
      position: static !important;
      contain: none !important;
      transform: none !important;
    }
    
    .plasmo-csui-container {
      display: contents !important;
      position: static !important;
      contain: none !important;
      transform: none !important;
    }
    
    :host {
      display: contents !important;
      position: static !important;
      contain: none !important;
      transform: none !important;
    }
  `
}

export function getNamespacedVariablesStyle(themeId: string = 'modern-dark'): string {
  const config = getThemeConfig(themeId)
  
  const variables = Object.entries(config.cssVariables)
    .map(([key, value]) => {
      const namespacedKey = `--nenspace-${key}`
      return `    ${namespacedKey}: ${value};`
    })
    .join('\n')
  
  const extendedVariables = Object.entries(EXTENDED_VARIABLES)
    .map(([key, value]) => `    --nenspace-${key}: ${value};`)
    .join('\n')
  
  return `
    :host {
${variables}
${extendedVariables}
    }
  `
}

export function getCompleteCSUIStyle(themeId: string = 'modern-dark'): string {
  return getRootContainerProtectionStyle() + '\n' + getNamespacedVariablesStyle(themeId)
}

export function getMinimalComponentStyles(): string {
  return `
    :host {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      color: inherit;
    }
    
    :host *,
    :host *::before,
    :host *::after {
      box-sizing: border-box;
    }
  `
}


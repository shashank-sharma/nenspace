/**
 * Keyboard Handler Content Script (Plasmo CSUI Enhancement)
 * 
 * Enhanced content script using Plasmo CSUI features for better
 * Shadow DOM isolation and automatic lifecycle management.
 */

import type { PlasmoCSConfig, PlasmoGetShadowHostId, PlasmoMount, PlasmoUnmount, PlasmoGetStyle } from "plasmo"
import { createLogger } from "~lib/utils/logger.util"
import { getCompleteCSUIStyle } from "~lib/utils/csui-styles.util"
import { getHelpDialogStyles } from "~lib/utils/csui-child-components-styles.util"

const logger = createLogger('[KeyboardHandler]')

// Module-level reference for cleanup on unmount
let mainObserver: MutationObserver | null = null

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
  // DO NOT use css property - it injects global.css which affects the page
  // Keyboard handler doesn't render UI, so no CSS needed
}

const SHADOW_HOST_ID = "nenspace-keyboard-handler"

export const getShadowHostId: PlasmoGetShadowHostId = () => SHADOW_HOST_ID

// Include HelpDialog styles since KeyboardHandler renders it
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = getCompleteCSUIStyle('modern-dark') + '\n' + getHelpDialogStyles()
  return style
}

/**
 * Fix Plasmo containers to allow position: fixed to work correctly.
 * Uses display: contents to make containers invisible to layout.
 */
export const mount: PlasmoMount = async () => {
  logger.debug('KeyboardHandler mounting...')
  
  const applyStyles = (element: HTMLElement, styles: Record<string, string>) => {
    for (const [property, value] of Object.entries(styles)) {
      element.style.setProperty(property, value, 'important')
    }
  }
  
  const fixContainers = () => {
    const shadowHost = document.getElementById(SHADOW_HOST_ID) as HTMLElement
    if (!shadowHost) return false
    
    // Fix the shadow host element (plasmo-csui custom element in Light DOM)
    applyStyles(shadowHost, {
      'display': 'contents',
      'position': 'static',
      'contain': 'none',
      'transform': 'none',
      'filter': 'none',
      'perspective': 'none',
      'will-change': 'auto'
    })
    
    const shadowRoot = shadowHost.shadowRoot
    if (!shadowRoot) return false
    
    const containers = [
      shadowRoot.getElementById('plasmo-shadow-container'),
      shadowRoot.querySelector('.plasmo-csui-container')
    ].filter(Boolean) as HTMLElement[]
    
    containers.forEach(container => {
      applyStyles(container, {
        'display': 'contents',
        'position': 'static',
        'contain': 'none',
        'transform': 'none',
        'top': 'auto',
        'left': 'auto',
        'right': 'auto',
        'bottom': 'auto'
      })
    })
    
    logger.debug('Fixed Plasmo containers for position: fixed support')
    return true
  }
  
  // Try to fix containers immediately and on delays
  const tryFix = () => {
    if (!fixContainers()) {
      const delays = [10, 50, 100, 250, 500, 1000]
      delays.forEach(delay => setTimeout(fixContainers, delay))
    }
  }
  
  tryFix()
  
  // Set up a MutationObserver to catch when Plasmo updates styles
  mainObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        fixContainers()
        break
      }
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement && 
              (node.id === SHADOW_HOST_ID || 
               node.tagName?.toLowerCase() === 'plasmo-csui')) {
            fixContainers()
            break
          }
        }
      }
    }
  })
  
  mainObserver.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['style']
  })
  
  return true
}

export const unmount: PlasmoUnmount = async () => {
  logger.debug('KeyboardHandler unmounting...')
  
  // Cleanup: Disconnect observer
  if (mainObserver) {
    mainObserver.disconnect()
    mainObserver = null
  }
  
  return true
}

logger.debug('Loading enhanced keyboard handler with CSUI...')

// Plasmo handles mounting, Shadow DOM, and cleanup automatically
export { default } from "./KeyboardHandler.svelte"

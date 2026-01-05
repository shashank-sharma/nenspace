/**
 * Shadow DOM Utilities
 * 
 * Helper functions for working with Shadow DOM in content scripts.
 * These utilities help verify and interact with Shadow DOM instances
 * created by Plasmo's CSUI features.
 */

import { createLogger } from "./logger.util"

const logger = createLogger("[ShadowDOM]")

/**
 * Shadow DOM Host IDs used by Plasmo content scripts
 */
export const SHADOW_HOST_IDS = {
  STATUS_INDICATOR: "nenspace-status-indicator",
  FLOATING_NAV: "nenspace-floating-nav",
  MODAL_CONTAINER: "nenspace-modal-container",
  KEYBOARD_HANDLER: "nenspace-keyboard-handler"
} as const

/**
 * Check if Shadow DOM is supported in the current browser
 */
export function isShadowDOMSupported(): boolean {
  return typeof HTMLElement.prototype.attachShadow === "function"
}

/**
 * Get a Shadow DOM host element by ID
 */
export function getShadowHost(hostId: string): HTMLElement | null {
  return document.getElementById(hostId)
}

/**
 * Get the Shadow Root from a host element
 */
export function getShadowRoot(hostId: string): ShadowRoot | null {
  const host = getShadowHost(hostId)
  return host?.shadowRoot || null
}

/**
 * Verify that a Shadow DOM instance is properly created
 */
export function verifyShadowDOM(hostId: string): {
  supported: boolean
  hostExists: boolean
  shadowRootExists: boolean
  isIsolated: boolean
} {
  const supported = isShadowDOMSupported()
  const host = getShadowHost(hostId)
  const shadowRoot = host?.shadowRoot || null

  const result = {
    supported,
    hostExists: !!host,
    shadowRootExists: !!shadowRoot,
    isIsolated: !!(shadowRoot && host)
  }

  if (!supported) {
    logger.warn(`Shadow DOM not supported in this browser`)
  } else if (!result.isIsolated) {
    logger.warn(`Shadow DOM not properly initialized for ${hostId}`)
  } else {
    logger.debug(`Shadow DOM verified for ${hostId}`)
  }

  return result
}

/**
 * Verify all Shadow DOM instances used by the extension
 */
export function verifyAllShadowDOMs(): Record<string, ReturnType<typeof verifyShadowDOM>> {
  const results: Record<string, ReturnType<typeof verifyShadowDOM>> = {}

  for (const [name, hostId] of Object.entries(SHADOW_HOST_IDS)) {
    results[name] = verifyShadowDOM(hostId)
  }

  return results
}

/**
 * Log Shadow DOM status for debugging
 */
export function logShadowDOMStatus(): void {
  logger.info("Shadow DOM Status Check")
  logger.info(`Browser Support: ${isShadowDOMSupported() ? "✅ Yes" : "❌ No"}`)

  const allStatuses = verifyAllShadowDOMs()
  
  for (const [name, status] of Object.entries(allStatuses)) {
    logger.info(`${name}:`, {
      hostExists: status.hostExists ? "✅" : "❌",
      shadowRootExists: status.shadowRootExists ? "✅" : "❌",
      isolated: status.isIsolated ? "✅" : "❌"
    })
  }
}

/**
 * Get element within Shadow DOM (for accessing elements inside shadow root)
 */
export function queryShadowSelector(hostId: string, selector: string): Element | null {
  const shadowRoot = getShadowRoot(hostId)
  return shadowRoot?.querySelector(selector) || null
}

/**
 * Check if an element is inside a Shadow DOM
 */
export function isInShadowDOM(element: Element): boolean {
  return element.getRootNode() instanceof ShadowRoot
}




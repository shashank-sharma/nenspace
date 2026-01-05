import type { PlasmoMount, PlasmoUnmount } from "plasmo"
import { createLogger } from "./logger.util"

const logger = createLogger('[PlasmoContainerFix]')

export function applyStyles(element: HTMLElement, styles: Record<string, string>): void {
  for (const [property, value] of Object.entries(styles)) {
    element.style.setProperty(property, value, 'important')
  }
}

export function fixPlasmoContainers(shadowHostId: string): boolean {
  const shadowHost = document.getElementById(shadowHostId) as HTMLElement
  if (!shadowHost) {
    return false
  }
  
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
  
  return true
}

export function createPlasmoContainerFixer(
  shadowHostId: string
): { mount: PlasmoMount; unmount: PlasmoUnmount } {
  let observer: MutationObserver | null = null
  
  const mount: PlasmoMount = async () => {
    const tryFix = () => {
      if (!fixPlasmoContainers(shadowHostId)) {
        const delays = [10, 50, 100, 250]
        delays.forEach(delay => setTimeout(() => fixPlasmoContainers(shadowHostId), delay))
      }
    }
    
    tryFix()
    
    observer = new MutationObserver(() => {
      fixPlasmoContainers(shadowHostId)
    })
    
    const shadowHost = document.getElementById(shadowHostId)
    if (shadowHost) {
      observer.observe(shadowHost, { 
        attributes: true,
        attributeFilter: ['style']
      })
    } else {
      observer.observe(document.body, { 
        childList: true,
        subtree: false
      })
    }
    
    return true
  }
  
  const unmount: PlasmoUnmount = async () => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    return true
  }
  
  return { mount, unmount }
}


import type { PlasmoCSConfig, PlasmoGetShadowHostId, PlasmoMount, PlasmoUnmount, PlasmoGetStyle } from "plasmo"
import ModalContainerSvelte from "./ModalContainer.svelte"
import { getCompleteCSUIStyle } from "~lib/utils/csui-styles.util"
import { getModalContainerStyles } from "~lib/utils/modal-container-styles.util"
import { getAllChildComponentStyles } from "~lib/utils/csui-child-components-styles.util"
import { getCommandPaletteStyles } from "~lib/utils/command-palette-styles.util"

let mainObserver: MutationObserver | null = null

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

const SHADOW_HOST_ID_VALUE = "nenspace-modal-container"

export const getShadowHostId: PlasmoGetShadowHostId = () => SHADOW_HOST_ID_VALUE

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  const completeStyles = getCompleteCSUIStyle('modern-dark')
  const modalStyles = getModalContainerStyles()
  const childStyles = getAllChildComponentStyles()
  const paletteStyles = getCommandPaletteStyles()
  style.textContent = completeStyles + '\n' + modalStyles + '\n' + childStyles + '\n' + paletteStyles
  return style
}

export const mount: PlasmoMount = async () => {
  const applyStyles = (element: HTMLElement, styles: Record<string, string>) => {
    for (const [property, value] of Object.entries(styles)) {
      element.style.setProperty(property, value, 'important')
    }
  }
  
  const injectFallbackStyles = (shadowRoot: ShadowRoot) => {
    if (shadowRoot.querySelector('#nenspace-fallback-styles')) {
      return
    }
    
    const completeStyles = getCompleteCSUIStyle('modern-dark')
    const modalStyles = getModalContainerStyles()
    const childStyles = getAllChildComponentStyles()
    const paletteStyles = getCommandPaletteStyles()
    const fullCSS = completeStyles + '\n' + modalStyles + '\n' + childStyles + '\n' + paletteStyles
    
    const style = document.createElement('style')
    style.id = 'nenspace-fallback-styles'
    style.textContent = fullCSS
    shadowRoot.insertBefore(style, shadowRoot.firstChild)
  }
  
  const fixContainers = () => {
    const shadowHost = document.getElementById(SHADOW_HOST_ID_VALUE) as HTMLElement
    if (!shadowHost) return false
    
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
    
    injectFallbackStyles(shadowRoot)
    
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
  
  const tryFix = () => {
    if (!fixContainers()) {
      const delays = [10, 50, 100, 250, 500, 1000]
      delays.forEach(delay => setTimeout(fixContainers, delay))
    }
  }
  
  tryFix()
  
  mainObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        fixContainers()
        break
      }
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement && 
              (node.id === SHADOW_HOST_ID_VALUE || 
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
  if (mainObserver) {
    mainObserver.disconnect()
    mainObserver = null
  }
  return true
}

export default ModalContainerSvelte


/**
 * Floating Navigation Content Script (Plasmo CSUI Enhancement)
 * 
 * Enhanced content script using Plasmo CSUI features for better
 * Shadow DOM isolation and automatic lifecycle management.
 */

import type { PlasmoCSConfig, PlasmoGetShadowHostId, PlasmoGetStyle } from "plasmo"
import FloatingNavSvelte from "./FloatingNav.svelte"
import { getCompleteCSUIStyle } from "~lib/utils/csui-styles.util"
import { getFloatingNavStyles } from "~lib/utils/floating-nav-styles.util"
import { createPlasmoContainerFixer } from "~lib/utils/plasmo-container-fix.util"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

const SHADOW_HOST_ID = "nenspace-floating-nav"

export const getShadowHostId: PlasmoGetShadowHostId = () => SHADOW_HOST_ID

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = getCompleteCSUIStyle('modern-dark') + '\n' + getFloatingNavStyles()
  return style
}

const { mount, unmount } = createPlasmoContainerFixer(SHADOW_HOST_ID)

export { mount, unmount }
export default FloatingNavSvelte
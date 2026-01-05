/**
 * Command Palette Content Script (Plasmo CSUI with Lazy Loading)
 * 
 * Optimized content script that only mounts the command palette when activated.
 * Uses Plasmo's CSUI features for Shadow DOM isolation and automatic lifecycle management.
 */

import type { PlasmoCSConfig, PlasmoGetShadowHostId, PlasmoGetStyle } from "plasmo"
import LazyCommandPalette from "~lib/components/LazyCommandPalette.svelte"
import { getCompleteCSUIStyle } from "~lib/utils/csui-styles.util"
import { getCommandPaletteStyles } from "~lib/utils/command-palette-styles.util"
import { createPlasmoContainerFixer } from "~lib/utils/plasmo-container-fix.util"

const SHADOW_HOST_ID = "nenspace-command-palette"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

export const getShadowHostId: PlasmoGetShadowHostId = () => SHADOW_HOST_ID

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = getCompleteCSUIStyle('modern-dark') + '\n' + getCommandPaletteStyles()
  return style
}

const { mount, unmount } = createPlasmoContainerFixer(SHADOW_HOST_ID)

export { mount, unmount }
export default LazyCommandPalette


/**
 * Status Indicator Content Script (Plasmo CSUI Enhancement)
 * 
 * Enhanced content script using Plasmo CSUI features for better
 * Shadow DOM isolation and automatic lifecycle management.
 */

import type { PlasmoCSConfig, PlasmoGetShadowHostId, PlasmoGetStyle } from "plasmo"
import { SHADOW_HOST_IDS } from "~lib/utils/shadow-dom.util"
import { getCompleteCSUIStyle } from "~lib/utils/csui-styles.util"
import { getStatusIndicatorStyles } from "~lib/utils/status-indicator-styles.util"
import { getTimerDisplayStyles, getErrorBoundaryStyles } from "~lib/utils/csui-child-components-styles.util"
import { createPlasmoContainerFixer } from "~lib/utils/plasmo-container-fix.util"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

export const getShadowHostId: PlasmoGetShadowHostId = () => SHADOW_HOST_IDS.STATUS_INDICATOR

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = getCompleteCSUIStyle('modern-dark') + '\n' + getStatusIndicatorStyles() + '\n' + getTimerDisplayStyles() + '\n' + getErrorBoundaryStyles()
  return style
}

const { mount, unmount } = createPlasmoContainerFixer(SHADOW_HOST_IDS.STATUS_INDICATOR)

export { mount, unmount }
export { default } from "./StatusIndicator.svelte"


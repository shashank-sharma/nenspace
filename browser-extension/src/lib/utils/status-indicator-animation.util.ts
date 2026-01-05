import { ISLAND_CONFIG } from '../config/island.config'
import type { Spring } from 'svelte/motion'

export interface IslandDimensions {
  width: number
  height: number
}

export function calculateBorderRadius(
  width: number,
  isExpanded: boolean,
  hasView: boolean,
  hasNotification: boolean
): string {
  if (isExpanded && hasView) {
    return ISLAND_CONFIG.DIMENSIONS.EXPANDED.borderRadius
  }

  if (hasNotification) {
    return ISLAND_CONFIG.DIMENSIONS.NOTIFICATION.borderRadius
  }

  const circleSize = ISLAND_CONFIG.DIMENSIONS.COMPACT.width
  return width > circleSize
    ? ISLAND_CONFIG.DIMENSIONS.NOTIFICATION.borderRadius
    : ISLAND_CONFIG.DIMENSIONS.COMPACT.borderRadius
}

export function startCollapseAnimation(
  widthSpring: Spring<number>,
  heightSpring: Spring<number>,
  delay: number = ISLAND_CONFIG.ANIMATION.COLLAPSE_DELAY
): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  timeoutId = setTimeout(() => {
    widthSpring.set(ISLAND_CONFIG.DIMENSIONS.COMPACT.width)
    heightSpring.set(ISLAND_CONFIG.DIMENSIONS.COMPACT.height)
  }, delay)

  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }
}


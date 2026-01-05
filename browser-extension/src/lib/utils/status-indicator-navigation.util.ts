import { createLogger } from './logger.util'
import type { Position } from './draggable.util'

const logger = createLogger('[StatusIndicatorNavigation]')

const PERSISTENCE_KEY = 'nenspace-status-indicator-state'
const NAVIGATION_KEY = 'nenspace-status-indicator-navigation'

export interface NavigationState {
  isNavigation: boolean
  lastUrl: string
  timestamp: number
  navigationId: number
}

export function checkPageNavigation(): boolean {
  if (typeof window === 'undefined') return false

  const currentNavigationId = Date.now() + Math.random()
  const previousState = localStorage.getItem(PERSISTENCE_KEY)
  const previousNavigation = localStorage.getItem(NAVIGATION_KEY)

  if (previousState && previousNavigation) {
    try {
      const state = JSON.parse(previousState)
      const navData: NavigationState = JSON.parse(previousNavigation)

      if (state.url !== window.location.href || navData.isNavigation) {
        logger.debug('Detected page navigation, preserving state')
        saveNavigationState(currentNavigationId)
        return true
      }
    } catch (error) {
      logger.warn('Failed to parse previous state', error)
    }
  }

  saveNavigationState(currentNavigationId, false)
  return false
}

export function saveNavigationState(
  navigationId: number,
  isNavigation: boolean = true
): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(
      NAVIGATION_KEY,
      JSON.stringify({
        isNavigation,
        lastUrl: window.location.href,
        timestamp: Date.now(),
        navigationId
      })
    )
  } catch (error) {
    logger.warn('Failed to save navigation state', error)
  }
}

export function savePositionState(position: Position, navigationId: number): void {
  if (typeof window === 'undefined') return

  const state = {
    url: window.location.href,
    position,
    timestamp: Date.now(),
    navigationId
  }

  try {
    localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(state))
  } catch (error) {
    logger.warn('Failed to save position state', error)
  }
}

export function restorePositionState(): Position | null {
  if (typeof window === 'undefined') return null

  const previousState = localStorage.getItem(PERSISTENCE_KEY)
  if (!previousState) return null

  try {
    const state = JSON.parse(previousState)
    if (state.position && Date.now() - state.timestamp < 10 * 60 * 1000) {
      logger.debug('Restored position from previous page', state.position)
      return state.position
    }
  } catch (error) {
    logger.warn('Failed to restore position state', error)
  }

  return null
}


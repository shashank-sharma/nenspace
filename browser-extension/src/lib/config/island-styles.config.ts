/**
 * Island Styles Configuration
 * 
 * Centralized styling for the floating island/status indicator.
 * All visual properties are defined here for easy modification.
 */

// =============================================================================
// DIMENSIONS
// =============================================================================

export const ISLAND_DIMENSIONS = {
  /** Height for circle and pill modes (px) */
  PILL_HEIGHT: 40,
  
  /** Width when in circle mode (equals height for perfect circle) */
  CIRCLE_SIZE: 40,
  
  /** Width when showing notification pill */
  NOTIFICATION_WIDTH: 280,
  
  /** Width when fully expanded */
  EXPANDED_WIDTH: 320,
  
  /** Height when fully expanded */
  EXPANDED_HEIGHT: 200,
  
  /** Margin from screen edges (px) */
  MARGIN: 16,
} as const

// =============================================================================
// ANIMATIONS
// =============================================================================

export const ISLAND_ANIMATIONS = {
  /** Width transition duration (ms) */
  WIDTH_DURATION: 300,
  
  /** Width transition easing */
  WIDTH_EASING: 'cubic-bezier(0.4, 0, 0.2, 1)',
  
  /** Opacity transition duration (ms) */
  OPACITY_DURATION: 200,
  
  /** Spring stiffness for width animation - higher = faster */
  SPRING_STIFFNESS: 0.4,
  
  /** Spring damping for width animation - lower = more bounce */
  SPRING_DAMPING: 0.8,
  
  /** Delay before collapse animation starts (ms) */
  COLLAPSE_DELAY: 100,
} as const

// =============================================================================
// COLORS
// =============================================================================

export const ISLAND_COLORS = {
  /** Default background color */
  BACKGROUND: '#000000',
  
  /** Primary text color */
  TEXT_PRIMARY: '#ffffff',
  
  /** Secondary text color */
  TEXT_SECONDARY: 'rgba(255, 255, 255, 0.7)',
  
  /** Muted text color */
  TEXT_MUTED: '#9ca3af',
  
  /** Box shadow */
  SHADOW: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  
  /** Backdrop blur amount */
  BACKDROP_BLUR: '24px',
} as const

// =============================================================================
// Z-INDEX
// =============================================================================

export const ISLAND_Z_INDEX = 2147483647

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const ISLAND_TYPOGRAPHY = {
  FONT_FAMILY: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  
  NOTIFICATION: {
    fontSize: '0.875rem',
    fontWeight: 500,
    maxWidth: '200px',
  },
  
  ICON_SIZE: 16,
} as const

// =============================================================================
// SPACING
// =============================================================================

export const ISLAND_SPACING = {
  /** Horizontal padding for notification content */
  NOTIFICATION_PADDING: 16,
  
  /** Gap between icon and text in notification */
  NOTIFICATION_GAP: 10,
} as const

// =============================================================================
// COMPUTED STYLES
// =============================================================================

export interface IslandStyleState {
  width: number
  height: number
  isExpanded: boolean
  hasNotification: boolean
  hasView: boolean
  isDragging: boolean
  isVisible: boolean
  backgroundColor: string
  positionX: number
  positionY: number
  useFitContent?: boolean
}

/**
 * Computes the container (outer wrapper) styles
 */
export function getContainerStyle(state: Pick<IslandStyleState, 'positionX' | 'positionY' | 'isVisible' | 'isDragging'>): string {
  return `
    position: fixed;
    z-index: ${ISLAND_Z_INDEX};
    left: ${state.positionX}px;
    top: ${state.positionY}px;
    display: ${state.isVisible ? 'block' : 'none'};
    cursor: ${state.isDragging ? 'grabbing' : 'grab'};
    transition: opacity ${ISLAND_ANIMATIONS.OPACITY_DURATION}ms ease;
    pointer-events: auto;
    margin: 0;
    padding: 0;
    width: fit-content;
    height: fit-content;
    box-sizing: border-box;
  `.trim().replace(/\s+/g, ' ')
}

/**
 * Computes whether the island is in circle mode
 */
export function isCircleMode(width: number, hasNotification: boolean, isExpanded: boolean): boolean {
  return width <= ISLAND_DIMENSIONS.PILL_HEIGHT + 5 && !hasNotification && !isExpanded
}

/**
 * Computes the border radius based on current width
 * - Circle mode: 50% for perfect circle
 * - Pill mode: half of height for stadium shape
 */
export function getBorderRadius(width: number, hasNotification: boolean, isExpanded: boolean): string {
  if (isCircleMode(width, hasNotification, isExpanded)) {
    return '50%'
  }
  return `${ISLAND_DIMENSIONS.PILL_HEIGHT / 2}px`
}

/**
 * Computes the inner pill/circle styles
 */
export function getInnerStyle(state: IslandStyleState): string {
  const circleMode = isCircleMode(state.width, state.hasNotification, state.isExpanded)
  const borderRadius = getBorderRadius(state.width, state.hasNotification, state.isExpanded)
  const height = state.isExpanded ? state.height : ISLAND_DIMENSIONS.PILL_HEIGHT
  
  const widthValue = state.useFitContent ? 'fit-content' : `${state.width}px`
  const minWidth = circleMode ? `${ISLAND_DIMENSIONS.PILL_HEIGHT}px` : 'auto'
  
  return `
    height: ${height}px;
    width: ${widthValue};
    min-width: ${minWidth};
    border-radius: ${borderRadius};
    background: ${state.backgroundColor};
    transition: 
      width ${ISLAND_ANIMATIONS.WIDTH_DURATION}ms ${ISLAND_ANIMATIONS.WIDTH_EASING},
      border-radius ${ISLAND_ANIMATIONS.WIDTH_DURATION}ms ${ISLAND_ANIMATIONS.WIDTH_EASING},
      height ${ISLAND_ANIMATIONS.WIDTH_DURATION}ms ${ISLAND_ANIMATIONS.WIDTH_EASING};
    display: flex;
    align-items: center;
    justify-content: ${circleMode ? 'center' : 'flex-start'};
    overflow: hidden;
    box-shadow: ${ISLAND_COLORS.SHADOW};
    backdrop-filter: blur(${ISLAND_COLORS.BACKDROP_BLUR});
    color: ${ISLAND_COLORS.TEXT_PRIMARY};
    position: relative;
    font-family: ${ISLAND_TYPOGRAPHY.FONT_FAMILY};
  `.trim().replace(/\s+/g, ' ')
}

/**
 * Notification content wrapper styles
 */
export const NOTIFICATION_CONTENT_STYLE = `
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 100%;
  width: 100%;
  padding: 0 ${ISLAND_SPACING.NOTIFICATION_PADDING}px;
  gap: ${ISLAND_SPACING.NOTIFICATION_GAP}px;
`.trim().replace(/\s+/g, ' ')

/**
 * Notification icon wrapper styles
 */
export const NOTIFICATION_ICON_STYLE = `
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`.trim().replace(/\s+/g, ' ')

/**
 * Notification text styles
 */
export const NOTIFICATION_TEXT_STYLE = `
  font-size: ${ISLAND_TYPOGRAPHY.NOTIFICATION.fontSize};
  font-weight: ${ISLAND_TYPOGRAPHY.NOTIFICATION.fontWeight};
  color: ${ISLAND_COLORS.TEXT_PRIMARY};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: ${ISLAND_TYPOGRAPHY.NOTIFICATION.maxWidth};
`.trim().replace(/\s+/g, ' ')

/**
 * Default icon container styles (centered)
 */
export const DEFAULT_ICON_CONTAINER_STYLE = `
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
`.trim().replace(/\s+/g, ' ')

/**
 * Default icon styles
 */
export function getDefaultIconStyle(color: string): string {
  return `
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: ${color};
  `.trim().replace(/\s+/g, ' ')
}


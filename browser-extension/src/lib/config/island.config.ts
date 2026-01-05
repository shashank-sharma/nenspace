export const ISLAND_CONFIG = {
  DIMENSIONS: {
    COMPACT: {
      width: 40,
      height: 40,
      borderRadius: '50%',
    },
    NOTIFICATION: {
      width: 280,
      height: 40,
      borderRadius: '20px',
    },
    EXPANDED: {
      width: 320,
      height: 200,
      borderRadius: '20px',
    },
  },
  ANIMATION: {
    DURATION: 300,
    EASING: 'ease-out',
    SPRING_STIFFNESS_WIDTH: 0.3,
    SPRING_DAMPING_WIDTH: 0.75,
    SPRING_STIFFNESS_HEIGHT: 0.3,
    SPRING_DAMPING_HEIGHT: 0.75,
    COLLAPSE_DELAY: 150, // ms - delay before starting collapse to let content fade
  },
  TIMING: {
    DISPLAY_STATE_UPDATE_DEBOUNCE: 50, // ms - debounce for display state updates
    NOTIFICATION_FADE_DURATION: 200, // ms - fade transition duration
    NOTIFICATION_SCALE_DURATION: 300, // ms - scale transition duration
  },
  SPACING: {
    PADDING: 10,
    GAP: 6,
    HEADER_GAP: 6,
    STATS_GAP: 12,
  },
  TYPOGRAPHY: {
    TITLE: {
      size: 12,
      weight: 600,
      lineHeight: 1.3,
    },
    DOMAIN: {
      size: 10,
      lineHeight: 1.2,
    },
    STAT_VALUE: {
      size: 11,
      weight: 600,
    },
    STAT_LABEL: {
      size: 9,
    },
    TIME_RANGE: {
      size: 9,
    },
    META_BADGE: {
      size: 9,
      padding: '1px 4px',
      borderRadius: '6px',
    },
    BUTTON: {
      size: 11,
      weight: 500,
      padding: '6px 10px',
      borderRadius: '6px',
    },
  },
  ICONS: {
    CLOSE: 14,
    STAT: 12,
    BUTTON: 12,
    DOMAIN: 16,
  },
  COLORS: {
    BACKGROUND: '#000000',
    TEXT_PRIMARY: '#ffffff',
    TEXT_SECONDARY: 'rgba(255, 255, 255, 0.7)',
    TEXT_TERTIARY: 'rgba(255, 255, 255, 0.6)',
    BADGE_BG: 'rgba(255, 255, 255, 0.15)',
    BUTTON_BG: 'rgba(255, 255, 255, 0.15)',
    BUTTON_BORDER: 'rgba(255, 255, 255, 0.2)',
    BUTTON_HOVER_BG: 'rgba(255, 255, 255, 0.25)',
    BUTTON_HOVER_BORDER: 'rgba(255, 255, 255, 0.3)',
  },
} as const;


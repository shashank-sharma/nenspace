/**
 * Status Display Framework Service
 * 
 * Manages different display modes and content for the status indicator.
 * Supports flexible expansion to show various content types.
 */

import type { 
  DisplayMode, 
  StatusDisplayContent, 
  DisplayDimensions,
  DisplayState,
  DisplayOptions 
} from '../types/status-display.types';
import { STATUS_INDICATOR_CONFIG } from '../utils/status-indicator.util';
import { createLogger } from '../utils/logger.util';

const logger = createLogger('[StatusDisplayService]');

/**
 * Display priority levels
 */
export const DISPLAY_PRIORITY = {
  SYSTEM_STATUS: 0,
  TIMER: 10,
  NOTIFICATION: 20,
  CUSTOM: 30,
} as const;

/**
 * Maximum dimensions to prevent blocking page content
 */
const MAX_DIMENSIONS = {
  width: 600,
  height: 400,
} as const;

/**
 * Default dimensions for different content types
 */
const DEFAULT_DIMENSIONS: Record<string, DisplayDimensions> = {
  compact: {
    width: STATUS_INDICATOR_CONFIG.DIMENSIONS.CIRCLE_SIZE,
    height: STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT,
    borderRadius: '50%',
  },
  notification: {
    width: STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH,
    height: STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT,
    borderRadius: '20px',
  },
  timer: {
    // Use 0 for fit-content (width will be determined by content)
    width: 0,
    height: STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT,
    borderRadius: '20px',
  },
  custom: {
    width: STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH,
    height: STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT,
    borderRadius: '20px',
  },
};

/**
 * Validate and constrain dimensions
 */
function constrainDimensions(dimensions: Partial<DisplayDimensions>): DisplayDimensions {
  let width = dimensions.width ?? DEFAULT_DIMENSIONS.custom.width;
  let height = dimensions.height ?? DEFAULT_DIMENSIONS.custom.height;

  // Constrain to max dimensions (unless width is 0 for fit-content)
  if (width > 0) {
    width = Math.min(width, MAX_DIMENSIONS.width);
  }
  height = Math.min(height, MAX_DIMENSIONS.height);

  return {
    width,
    height,
    borderRadius: dimensions.borderRadius ?? '20px',
  };
}

class StatusDisplayServiceImpl {
  #currentContent: StatusDisplayContent | null = null;
  #currentNotification: StatusDisplayContent | null = null;
  #currentTimer: StatusDisplayContent | null = null;
  #currentCustom: StatusDisplayContent | null = null;

  /**
   * Get current display state
   */
  getState(): DisplayState {
    // Determine what to show based on priority
    // Notifications can overlay timers
    const notification = this.#currentNotification;
    const timer = this.#currentTimer;
    const custom = this.#currentCustom;

    // Choose highest priority content
    let activeContent: StatusDisplayContent | null = null;
    
    if (custom) {
      activeContent = custom;
    } else if (notification) {
      activeContent = notification;
    } else if (timer) {
      activeContent = timer;
    }

    const mode: DisplayMode = activeContent 
      ? activeContent.mode 
      : 'compact';

    // Get dimensions
    const dimensions = this.#getDimensions(activeContent, mode);
    
    // Get background color
    const backgroundColor = this.#getBackgroundColor(activeContent);

    // Get border radius
    const borderRadius = dimensions.borderRadius ?? '50%';

    return {
      mode,
      content: activeContent,
      dimensions,
      backgroundColor,
      borderRadius,
    };
  }

  /**
   * Show notification content (temporary, can overlay timer)
   */
  showNotification(content: StatusDisplayContent, options?: DisplayOptions): void {
    if (content.type !== 'text' && content.mode !== 'notification') {
      logger.warn('Invalid notification content type', { type: content.type });
      return;
    }

    const notification: StatusDisplayContent = {
      ...content,
      mode: 'notification',
      priority: options?.priority ?? DISPLAY_PRIORITY.NOTIFICATION,
      dimensions: options?.dimensions 
        ? { ...DEFAULT_DIMENSIONS.notification, ...options.dimensions }
        : DEFAULT_DIMENSIONS.notification,
    };

    this.#currentNotification = notification;

    logger.debug('Notification shown', { id: content.id, duration: options?.duration });
  }

  /**
   * Hide notification
   */
  hideNotification(): void {
    this.#currentNotification = null;
    logger.debug('Notification hidden');
  }

  /**
   * Show timer content (persistent base layer)
   */
  showTimer(content: StatusDisplayContent): void {
    if (content.type !== 'timer') {
      logger.warn('Invalid timer content type', { type: content.type });
      return;
    }

    const timer: StatusDisplayContent = {
      ...content,
      mode: 'timer',
      priority: DISPLAY_PRIORITY.TIMER,
      // Use provided dimensions or default to fit-content (width: 0)
      dimensions: content.dimensions || DEFAULT_DIMENSIONS.timer,
    };

    this.#currentTimer = timer;
    logger.debug('Timer shown', { id: content.id });
  }

  /**
   * Hide timer
   */
  hideTimer(id?: string): void {
    if (id) {
      if (this.#currentTimer?.id === id) {
        this.#currentTimer = null;
        logger.debug('Timer hidden', { id });
      }
    } else {
      this.#currentTimer = null;
      logger.debug('All timers hidden');
    }
  }

  /**
   * Show custom content
   */
  showCustom(content: StatusDisplayContent, options?: DisplayOptions): void {
    if (content.mode !== 'custom') {
      logger.warn('Invalid custom content mode', { mode: content.mode });
      return;
    }

    const custom: StatusDisplayContent = {
      ...content,
      priority: options?.priority ?? DISPLAY_PRIORITY.CUSTOM,
      dimensions: options?.dimensions
        ? constrainDimensions({ ...DEFAULT_DIMENSIONS.custom, ...options.dimensions })
        : DEFAULT_DIMENSIONS.custom,
    };

    this.#currentCustom = custom;
    logger.debug('Custom content shown', { id: content.id });
  }

  /**
   * Hide custom content
   */
  hideCustom(id?: string): void {
    if (id) {
      if (this.#currentCustom?.id === id) {
        this.#currentCustom = null;
        logger.debug('Custom content hidden', { id });
      }
    } else {
      this.#currentCustom = null;
      logger.debug('All custom content hidden');
    }
  }

  /**
   * Show image content
   */
  showImage(content: StatusDisplayContent, options?: DisplayOptions): void {
    if (content.type !== 'image') {
      logger.warn('Invalid image content type', { type: content.type });
      return;
    }

    const image: StatusDisplayContent = {
      ...content,
      mode: content.mode || 'custom',
      priority: options?.priority ?? DISPLAY_PRIORITY.CUSTOM,
      dimensions: options?.dimensions
        ? constrainDimensions({ ...DEFAULT_DIMENSIONS.custom, ...options.dimensions })
        : DEFAULT_DIMENSIONS.custom,
    };

    this.#currentCustom = image;
    logger.debug('Image shown', { id: content.id });
  }

  /**
   * Show chart content
   */
  showChart(content: StatusDisplayContent, options?: DisplayOptions): void {
    if (content.type !== 'chart') {
      logger.warn('Invalid chart content type', { type: content.type });
      return;
    }

    const chart: StatusDisplayContent = {
      ...content,
      mode: content.mode || 'custom',
      priority: options?.priority ?? DISPLAY_PRIORITY.CUSTOM,
      dimensions: options?.dimensions
        ? constrainDimensions({ ...DEFAULT_DIMENSIONS.custom, ...options.dimensions })
        : DEFAULT_DIMENSIONS.custom,
    };

    this.#currentCustom = chart;
    logger.debug('Chart shown', { id: content.id });
  }

  /**
   * Show component content
   */
  showComponent(content: StatusDisplayContent, options?: DisplayOptions): void {
    if (content.type !== 'component') {
      logger.warn('Invalid component content type', { type: content.type });
      return;
    }

    const component: StatusDisplayContent = {
      ...content,
      mode: content.mode || 'custom',
      priority: options?.priority ?? DISPLAY_PRIORITY.CUSTOM,
      dimensions: options?.dimensions
        ? constrainDimensions({ ...DEFAULT_DIMENSIONS.custom, ...options.dimensions })
        : DEFAULT_DIMENSIONS.custom,
    };

    this.#currentCustom = component;
    logger.debug('Component shown', { id: content.id });
  }

  /**
   * Get dimensions for content
   */
  #getDimensions(
    content: StatusDisplayContent | null,
    mode: DisplayMode
  ): DisplayDimensions {
    // For timer mode, always use width 0 (fit-content)
    if (mode === 'timer') {
      const baseDimensions = content?.dimensions || DEFAULT_DIMENSIONS.timer;
      return {
        ...baseDimensions,
        width: 0, // Always use fit-content for timers
      };
    }
    
    if (content?.dimensions) {
      // Constrain dimensions to max values
      return constrainDimensions(content.dimensions);
    }

    return DEFAULT_DIMENSIONS[mode] ?? DEFAULT_DIMENSIONS.compact;
  }

  /**
   * Get background color for content
   */
  #getBackgroundColor(content: StatusDisplayContent | null): string {
    if (!content) {
      return '#000000'; // Default black
    }

    // Timer content uses black background to be consistent
    if (content.type === 'timer') {
      return '#000000'; // Black background
    }

    // Text content (notifications) can have custom background
    if (content.type === 'text' && 'backgroundColor' in content) {
      return content.backgroundColor ?? '#000000';
    }

    return '#000000';
  }

  /**
   * Clear all content
   */
  clear(): void {
    this.#currentNotification = null;
    this.#currentTimer = null;
    this.#currentCustom = null;
    logger.debug('All display content cleared');
  }
}

// Export singleton instance
export const StatusDisplayService = new StatusDisplayServiceImpl();


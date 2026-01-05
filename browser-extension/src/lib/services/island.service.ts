import type { IslandView, IslandState, IslandViewType } from '../types/island.types';
import { createLogger } from '../utils/logger.util';
import { ISLAND_CONFIG } from '../config/island.config';
import { IslandTemplateRegistry } from './island-template-registry.service';

const logger = createLogger('[IslandService]');

class IslandServiceImpl {
  #currentView: IslandView | null = null;
  #isExpanded = false;
  #timeoutId: ReturnType<typeof setTimeout> | null = null;
  #listeners: Set<(state: IslandState) => void> = new Set();

  get state(): IslandState {
    return {
      isExpanded: this.#isExpanded,
      currentView: this.#currentView,
      expandedWidth: this.#currentView
        ? ISLAND_CONFIG.DIMENSIONS.EXPANDED.width
        : 0,
      expandedHeight: this.#currentView
        ? ISLAND_CONFIG.DIMENSIONS.EXPANDED.height
        : 0,
    };
  }

  /**
   * Subscribe to island state changes
   * @param listener - Callback function called when state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: (state: IslandState) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #notify(): void {
    const state = this.state;
    this.#listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        logger.error('Error in island state listener', error);
      }
    });
  }

  /**
   * Show an island view by type
   * @param type - The type of island view to show
   * @param props - Props to pass to the component
   * @param options - Display options (priority, duration)
   */
  showByType(type: IslandViewType, props: Record<string, unknown> = {}, options: { priority?: number; duration?: number } = {}): void {
    try {
      const template = IslandTemplateRegistry.get(type);
      if (!template) {
        logger.warn('Template not found', { type });
        return;
      }

      const view: IslandView = {
        id: `${type}-${Date.now()}`,
        type,
        component: template.component,
        props: { ...template.defaultProps, ...props },
        priority: options.priority ?? 50,
        duration: options.duration ?? 0,
      };

      this.show(view);
    } catch (error) {
      logger.error('Failed to show island by type', error);
    }
  }

  show(view: IslandView): void {
    try {
      if (this.#timeoutId) {
        clearTimeout(this.#timeoutId);
        this.#timeoutId = null;
      }

      if (this.#currentView && this.#currentView.priority > view.priority) {
        logger.debug('Higher priority view already showing', {
          current: this.#currentView.id,
          requested: view.id,
        });
        return;
      }

      this.#currentView = view;
      this.#isExpanded = true;
      this.#notify();

      if (view.duration && view.duration > 0) {
        this.#timeoutId = setTimeout(() => {
          try {
            this.hide();
          } catch (error) {
            logger.error('Error in auto-hide timeout', error);
            this.#timeoutId = null;
            this.#isExpanded = false;
            this.#currentView = null;
            this.#notify();
          }
        }, view.duration);
      }

      logger.debug('Island view shown', { id: view.id, type: view.type });
    } catch (error) {
      logger.error('Failed to show island view', error);
    }
  }

  hide(): void {
    try {
      if (this.#timeoutId) {
        clearTimeout(this.#timeoutId);
        this.#timeoutId = null;
      }

      this.#isExpanded = false;
      this.#currentView = null;
      this.#notify();

      logger.debug('Island view hidden');
    } catch (error) {
      logger.error('Failed to hide island view', error);
      this.#timeoutId = null;
      this.#isExpanded = false;
      this.#currentView = null;
    }
  }

  toggle(): void {
    try {
      if (this.#isExpanded) {
        this.hide();
      } else if (this.#currentView) {
        this.#isExpanded = true;
        this.#notify();
      }
    } catch (error) {
      logger.error('Failed to toggle island', error);
    }
  }
}

export const IslandService = new IslandServiceImpl();

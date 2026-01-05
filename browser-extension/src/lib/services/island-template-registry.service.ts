import type { IslandViewType, IslandTemplate } from '../types/island.types';
import ActivityIsland from '../components/island/ActivityIsland.svelte';
import NotificationIsland from '../components/island/NotificationIsland.svelte';
import { createLogger } from '../utils/logger.util';

const logger = createLogger('[IslandTemplateRegistry]');

class IslandTemplateRegistryServiceImpl {
  #templates: Map<IslandViewType, IslandTemplate> = new Map();

  constructor() {
    this.register('activity', {
      component: ActivityIsland,
    });
    this.register('notification', {
      component: NotificationIsland,
    });
  }

  register(type: IslandViewType, template: IslandTemplate): void {
    this.#templates.set(type, template);
    logger.debug('Template registered', { type });
  }

  get(type: IslandViewType): IslandTemplate | null {
    return this.#templates.get(type) || null;
  }

  has(type: IslandViewType): boolean {
    return this.#templates.has(type);
  }

  list(): IslandViewType[] {
    return Array.from(this.#templates.keys());
  }
}

export const IslandTemplateRegistry = new IslandTemplateRegistryServiceImpl();


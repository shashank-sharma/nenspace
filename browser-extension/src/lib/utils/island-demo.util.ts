import { IslandService } from '../services/island.service';
import type { ActivityData, NotificationData } from '../types/island.types';
import { createLogger } from './logger.util';

const logger = createLogger('[IslandDemo]');

export function showDemoActivityIsland(): void {
  logger.debug('Creating demo activity island');
  
  const demoActivity: ActivityData = {
    user: 'user_123',
    browser_profile: 'profile_456',
    url: 'https://github.com/features',
    title: 'GitHub Features - The complete developer platform',
    domain: 'github.com',
    start_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    end_time: new Date().toISOString(),
    duration: 300,
    tab_id: 1,
    window_id: 1,
    audible: false,
    incognito: false,
    metadata: JSON.stringify({ referrer: 'https://google.com' }),
    session_id: 'session_789',
  };

  IslandService.showByType('activity', {
    activity: demoActivity,
    onClose: () => {
      logger.debug('Demo island closed');
      IslandService.hide();
    },
  }, {
    priority: 50,
    duration: 0,
  });
  
  const state = IslandService.state;
  logger.debug('Island state after show', { 
    isExpanded: state.isExpanded, 
    hasView: !!state.currentView 
  });
}

export function showDemoNotificationIsland(): void {
  logger.debug('Creating demo notification island');
  
  const demoNotification: NotificationData = {
    title: 'New Message',
    message: 'You have a new notification from the system',
    variant: 'info',
  };

  IslandService.showByType('notification', {
    notification: demoNotification,
    onClose: () => {
      logger.debug('Demo notification closed');
      IslandService.hide();
    },
  }, {
    priority: 50,
    duration: 5000,
  });
}

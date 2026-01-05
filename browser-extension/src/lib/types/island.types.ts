import type { ComponentType } from 'svelte';

export type IslandViewType = 'activity' | 'timer' | 'notification' | 'custom';

export interface IslandView {
  id: string;
  type: IslandViewType;
  component: ComponentType;
  props?: Record<string, unknown>;
  priority: number;
  duration?: number;
}

export interface IslandState {
  isExpanded: boolean;
  currentView: IslandView | null;
  expandedWidth: number;
  expandedHeight: number;
}

export interface ActivityData {
  user: string;
  browser_profile: string;
  url: string;
  title: string;
  domain: string;
  start_time: string;
  end_time?: string;
  duration: number;
  tab_id: number;
  window_id: number;
  audible: boolean;
  incognito: boolean;
  metadata?: string;
  session_id: string;
}

export interface ActivityIslandProps {
  activity: ActivityData;
  onClose?: () => void;
}

export interface NotificationData {
  title?: string;
  message?: string;
  icon?: ComponentType;
  variant?: 'success' | 'error' | 'info' | 'warning' | 'default';
  actions?: Array<{
    label?: string;
    icon?: ComponentType;
    onClick?: () => void;
  }>;
}

export interface NotificationIslandProps {
  notification: NotificationData;
  onClose?: () => void;
}

export type IslandTemplate = {
  component: ComponentType;
  defaultProps?: Record<string, unknown>;
};


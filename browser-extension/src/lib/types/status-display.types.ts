/**
 * Status Display Framework Types
 * 
 * Type definitions for the flexible status indicator display system
 */

import type { ComponentType } from 'svelte';

/**
 * Display modes for the status indicator
 */
export type DisplayMode = 'compact' | 'notification' | 'timer' | 'custom';

/**
 * Content types supported by the display framework
 */
export type ContentType = 'text' | 'image' | 'chart' | 'component' | 'timer';

/**
 * Display dimensions
 */
export interface DisplayDimensions {
  width: number;
  height: number;
  borderRadius?: string;
}

/**
 * Base content interface
 */
export interface DisplayContent {
  id: string;
  type: ContentType;
  mode: DisplayMode;
  priority: number; // Higher = more important
  dimensions?: DisplayDimensions;
}

/**
 * Text content
 */
export interface TextContent extends DisplayContent {
  type: 'text';
  text: string;
  icon?: ComponentType;
  backgroundColor?: string;
  textColor?: string;
}

/**
 * Image content
 */
export interface ImageContent extends DisplayContent {
  type: 'image';
  src: string;
  alt?: string;
}

/**
 * Chart content (placeholder for future implementation)
 */
export interface ChartContent extends DisplayContent {
  type: 'chart';
  chartType: 'line' | 'bar' | 'pie';
  data: unknown;
}

/**
 * Custom component content
 */
export interface ComponentContent extends DisplayContent {
  type: 'component';
  component: ComponentType;
  props?: Record<string, unknown>;
}

/**
 * Timer content
 */
export interface TimerContent extends DisplayContent {
  type: 'timer';
  timerId: string;
}

/**
 * Union type of all content types
 */
export type StatusDisplayContent = 
  | TextContent 
  | ImageContent 
  | ChartContent 
  | ComponentContent 
  | TimerContent;

/**
 * Display state
 */
export interface DisplayState {
  mode: DisplayMode;
  content: StatusDisplayContent | null;
  dimensions: DisplayDimensions;
  backgroundColor: string;
  borderRadius: string;
}

/**
 * Display options for showing content
 */
export interface DisplayOptions {
  duration?: number; // Auto-dismiss after duration (0 = persistent)
  priority?: number; // Display priority
  dimensions?: Partial<DisplayDimensions>;
  backgroundColor?: string;
}




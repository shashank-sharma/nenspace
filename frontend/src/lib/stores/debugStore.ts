import { writable, get } from 'svelte/store';
import type { DebugSection } from '$lib/components/debug/DebugPanel.svelte';

// Initialize from localStorage if available
const storedDebugEnabled = typeof localStorage !== 'undefined' 
  ? localStorage.getItem('debugEnabled') === 'true'
  : false;

export const debugEnabled = writable<boolean>(storedDebugEnabled);

// Save debug state when it changes
debugEnabled.subscribe(value => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('debugEnabled', value.toString());
  }
});

// Example debug settings
export const networkDebugSettings = writable({
  mockResponses: false,
  simulateLatency: false,
  latencyMs: 1000,
  logRequests: false,
});

export const uiDebugSettings = writable({
  showBoundingBoxes: false,
  highlightComponents: false,
  slowAnimations: false,
});

export const storageDebugSettings = writable({
  clearOnStartup: false,
  persistMode: 'session',
});

// Helper to toggle debug mode
export function toggleDebugMode() {
  debugEnabled.update(value => !value);
}

// Create sections configuration for Debug Panel
export function getDebugSections(): DebugSection[] {
  return [
    {
      id: 'network',
      title: 'Network Debugging',
      expanded: true,
      items: [
        {
          id: 'mockResponses',
          label: 'Mock API Responses',
          component: ToggleControl,
          props: {
            value: get(networkDebugSettings).mockResponses,
            onChange: (val: boolean) => {
              networkDebugSettings.update(settings => ({
                ...settings,
                mockResponses: val
              }));
            }
          }
        },
        {
          id: 'simulateLatency',
          label: 'Simulate Network Latency',
          component: ToggleControl,
          props: {
            value: get(networkDebugSettings).simulateLatency,
            onChange: (val: boolean) => {
              networkDebugSettings.update(settings => ({
                ...settings,
                simulateLatency: val
              }));
            }
          }
        },
        {
          id: 'latencyMs',
          label: 'Latency (milliseconds)',
          component: NumberControl,
          props: {
            value: get(networkDebugSettings).latencyMs,
            min: 0,
            step: 100,
            onChange: (val: number) => {
              networkDebugSettings.update(settings => ({
                ...settings,
                latencyMs: val
              }));
            }
          }
        },
        {
          id: 'logRequests',
          label: 'Log API Requests to Console',
          component: ToggleControl,
          props: {
            value: get(networkDebugSettings).logRequests,
            onChange: (val: boolean) => {
              networkDebugSettings.update(settings => ({
                ...settings,
                logRequests: val
              }));
            }
          }
        },
      ]
    },
    {
      id: 'ui',
      title: 'UI Debugging',
      expanded: false,
      items: [
        {
          id: 'showBoundingBoxes',
          label: 'Show Component Bounding Boxes',
          component: ToggleControl,
          props: {
            value: get(uiDebugSettings).showBoundingBoxes,
            onChange: (val: boolean) => {
              uiDebugSettings.update(settings => ({
                ...settings,
                showBoundingBoxes: val
              }));
            }
          }
        },
        {
          id: 'highlightComponents',
          label: 'Highlight Components on Hover',
          component: ToggleControl,
          props: {
            value: get(uiDebugSettings).highlightComponents,
            onChange: (val: boolean) => {
              uiDebugSettings.update(settings => ({
                ...settings,
                highlightComponents: val
              }));
            }
          }
        },
        {
          id: 'slowAnimations',
          label: 'Slow Down Animations',
          component: ToggleControl,
          props: {
            value: get(uiDebugSettings).slowAnimations,
            onChange: (val: boolean) => {
              uiDebugSettings.update(settings => ({
                ...settings,
                slowAnimations: val
              }));
            }
          }
        },
      ]
    },
    {
      id: 'storage',
      title: 'Storage & Data',
      expanded: false,
      items: [
        {
          id: 'clearOnStartup',
          label: 'Clear Local Storage on Startup',
          component: ToggleControl,
          props: {
            value: get(storageDebugSettings).clearOnStartup,
            onChange: (val: boolean) => {
              storageDebugSettings.update(settings => ({
                ...settings,
                clearOnStartup: val
              }));
            }
          }
        },
        {
          id: 'persistMode',
          label: 'Persistence Mode',
          component: SelectControl,
          props: {
            value: get(storageDebugSettings).persistMode,
            options: [
              { label: 'Session Only', value: 'session' },
              { label: 'Local Storage', value: 'local' },
              { label: 'Memory Only', value: 'memory' },
            ],
            onChange: (val: string) => {
              storageDebugSettings.update(settings => ({
                ...settings,
                persistMode: val
              }));
            }
          }
        }
      ]
    }
  ];
}
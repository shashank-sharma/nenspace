# Status Indicator Feature

**Dynamic Island-style status notification system** for real-time UI status and notifications.

> **Note**: This feature is separate from the backend notification system (`features/notifications/`) which handles bell icon notifications.

## Overview

The Status Indicator feature provides a macOS Dynamic Island-inspired notification system that displays:

- **System Status**: Real-time connection status (online/offline, backend health, API loading)
- **Island Notifications**: Toast-style messages (success, error, info, warning, loading)
- **Cross-platform Support**: Browser (StatusIndicator) + Tauri (FloatingStatusWidget)

## Architecture

```
features/status-indicator/
├── components/           # UI components (future)
├── services/            # Core notification services
│   ├── island-notification.service.svelte.ts    # UI notification management
│   ├── notification-broadcaster.service.svelte.ts  # Central coordinator
│   └── notification-sync.service.svelte.ts       # Tauri cross-window sync
├── utils/              # Utilities and helpers
│   ├── notification-colors.util.ts  # Centralized color management
│   └── status-indicator.util.ts     # Status logic and configuration
└── index.ts            # Barrel export
```

## Services

### IslandNotificationService

Manages island-style notifications with queueing and auto-dismiss.

```typescript
import { IslandNotificationService } from '$lib/features/status-indicator';

// Simple notifications
IslandNotificationService.success('Task completed!');
IslandNotificationService.error('Failed to save');
IslandNotificationService.info('Processing...', { duration: 5000 });

// No auto-dismiss
IslandNotificationService.loading('Uploading...', { duration: 0 });

// Manual dismiss
IslandNotificationService.hide();
```

### NotificationBroadcaster

Central hub that broadcasts notifications to **all** components (StatusIndicator + FloatingWidget).

```typescript
import { NotificationBroadcaster } from '$lib/features/status-indicator';

// Broadcasts to both browser and Tauri components
NotificationBroadcaster.success('Synced successfully!');
NotificationBroadcaster.error('Sync failed', { duration: 5000 });
```

### NotificationSyncService

Synchronizes notifications between Tauri windows (FloatingWidget → Main Window).

```typescript
import { NotificationSyncService } from '$lib/features/status-indicator';

// Initialize once in root layout
await NotificationSyncService.initialize();
```

## Utilities

### Notification Colors

Centralized color management for consistency across platforms:

```typescript
import { getNotificationColors, getNotificationBgRgb } from '$lib/features/status-indicator';

// Get all colors for a variant
const colors = getNotificationColors('success');
// { bgRgb: 'rgb(34 197 94)', bgTailwind: 'bg-green-600 dark:bg-green-700', ... }

// Platform-specific
const bgRgb = getNotificationBgRgb('success'); // For Tauri
const bgTailwind = getNotificationBgTailwind('success'); // For Browser
```

### Status Indicator Utils

System status management and configuration:

```typescript
import { 
    STATUS_INDICATOR_CONFIG,
    getStatusIndicatorState,
    type SystemStatus 
} from '$lib/features/status-indicator';

const status: SystemStatus = {
    isBackendDown: false,
    isOffline: false,
    realtimeStatus: 'connected',
    isApiLoading: false,
    realtimeConnected: true,
};

const state = getStatusIndicatorState(status);
// { priority, icon, iconColor, backgroundColor, message }
```

## Usage Examples

### Basic Notification

```typescript
import { NotificationBroadcaster } from '$lib/features/status-indicator';

async function saveData() {
    try {
        await api.save(data);
        NotificationBroadcaster.success('Data saved successfully!');
    } catch (error) {
        NotificationBroadcaster.error('Failed to save data');
    }
}
```

### Custom Notification

```typescript
import { IslandNotificationService } from '$lib/features/status-indicator';

IslandNotificationService.show('Custom notification', 'info', {
    duration: 3000,
    backgroundColor: 'rgb(168 85 247)', // purple
    textColor: 'rgb(243 232 255)',
});
```

### Debug Testing

Open the Debug Panel (bottom right) and navigate to "Notification System" to test all notification variants.

## Components Using This Feature

- **StatusIndicator** (`lib/components/StatusIndicator.svelte`) - Browser implementation
- **FloatingStatusWidget** (`lib/components/FloatingStatusWidget.svelte`) - Tauri implementation
- **RealtimeService** - Broadcasts connection status
- **Debug Panel** - Testing interface

## Color Variants

| Variant   | Use Case                    | Color  |
|-----------|-----------------------------|--------|
| `success` | Successful operations       | Green  |
| `error`   | Failed operations/errors    | Red    |
| `warning` | Warnings/cautions          | Yellow |
| `info`    | Informational messages      | Blue   |
| `loading` | In-progress operations      | Gray   |
| `default` | Generic/custom             | Black  |

## Best Practices

1. **Use NotificationBroadcaster** for application-wide notifications
2. **Use IslandNotificationService** only for component-specific needs
3. **Set appropriate durations**: 3000ms (default), 5000ms (important), 0 (manual dismiss)
4. **Keep messages concise**: Island space is limited
5. **Use correct variant**: Matches user expectations and accessibility

## Cross-Platform Behavior

| Environment | Component             | Features                          |
|-------------|-----------------------|-----------------------------------|
| Browser     | StatusIndicator       | Top-center island, draggable      |
| Tauri       | FloatingStatusWidget  | Floating window, always-on-top    |

Both components stay in sync via `NotificationBroadcaster` and `NotificationSyncService`.

## Related Features

- **notifications** (`features/notifications/`) - Backend notification system (bell icon)
- **realtime** (`services/realtime.service.svelte`) - WebSocket status updates
- **health** (`services/health.service.svelte`) - Backend health monitoring


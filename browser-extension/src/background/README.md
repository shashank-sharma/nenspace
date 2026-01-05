# Background Script Architecture

This directory contains the refactored background service worker for the Nenspace browser extension. The code has been reorganized into a maintainable, production-grade architecture with clear separation of concerns.

## Directory Structure

```
background/
├── index.ts                    # Main entry point and orchestration
├── config.ts                   # Centralized configuration
├── types.ts                    # TypeScript type definitions
├── services/
│   ├── health-monitor.ts      # Backend health monitoring service
│   └── realtime-manager.ts    # PocketBase realtime connection manager
├── handlers/
│   ├── install-handler.ts     # Extension installation handler
│   └── storage-handler.ts     # Storage change handler
├── messages/                  # Plasmo message handlers (auto-discovered)
│   ├── check-health.ts       # Health check message handler
│   ├── get-tabs.ts           # Tab management message handler
│   └── ...                   # Other message handlers
└── utils/
    ├── logger.ts              # Structured logging utility
    ├── browser-api.ts         # Browser API abstraction layer
    └── async.ts               # Async utilities (timeout, retry, etc.)
```

## Key Components

### 1. BackgroundService (index.ts)
The main orchestrator that coordinates all background functionality:
- Initializes health monitor and realtime manager
- Sets up message routing and event listeners
- Handles health status changes
- Manages service lifecycle

### 2. HealthMonitor (services/health-monitor.ts)
Monitors backend API health:
- Periodic health checks (configurable interval)
- Broadcasts health status to content scripts
- Triggers realtime reconnection when backend recovers
- Marks backend as unhealthy on API failures

### 3. RealtimeManager (services/realtime-manager.ts)
Manages PocketBase realtime connections:
- Establishes and maintains WebSocket connections
- Handles authentication and profile verification
- Subscribes to browser-specific notification topics
- Broadcasts realtime messages to content scripts
- Implements retry logic with exponential backoff
- Prevents CORS errors when backend is unhealthy

### 4. Message Handlers (messages/*.ts)
Plasmo auto-discovered message handlers for content script communication:
- `GET_TABS` - Query all browser tabs
- `SWITCH_TAB` - Switch to a specific tab
- `REALTIME_GET_STATUS` - Get realtime connection status
- `GET_BROWSER_ID` - Get current browser profile ID
- `GET_HEALTH_STATUS` - Get backend health status
- `CHECK_HEALTH` - Trigger immediate health check

### 5. BrowserAPI (utils/browser-api.ts)
Abstraction layer for browser APIs:
- Unified interface for Chrome and Firefox
- Promise-based API wrappers
- Consistent error handling
- Easy to mock for testing

### 6. Logger (utils/logger.ts)
Structured logging utility:
- Configurable log levels (DEBUG, INFO, WARN, ERROR)
- Prefixed log messages for easy filtering
- Optional timestamps
- Production-ready logging

## Configuration

All configuration is centralized in `config.ts`:

```typescript
const BackgroundConfig = {
  HEALTH_CHECK_INTERVAL_MS: 30_000,        // 30 seconds
  HEALTH_CHECK_TIMEOUT_MS: 5_000,          // 5 seconds
  REALTIME_MAX_RECONNECT_ATTEMPTS: 10,
  REALTIME_CONNECTION_TIMEOUT_MS: 10_000,  // 10 seconds
  REALTIME_MAX_RETRY_ATTEMPTS: 3,
  REALTIME_RETRY_COOLDOWN_MS: 60_000,      // 1 minute
  DEFAULT_NOTIFICATION_DURATION_MS: 3_000,
}
```

## Type Safety

All types are defined in `types.ts`:
- Message types (background ↔ content script)
- Status payloads
- Service interfaces
- Browser profile and tab information

## Error Handling

Consistent error handling throughout:
- Custom error classes (e.g., `BrowserAPIError`)
- Proper error propagation
- Graceful degradation
- Structured error logging

## Dependency Injection

Services use constructor-based dependency injection:
- Easy to test in isolation
- Clear dependencies
- Flexible configuration
- Better separation of concerns

## Testing

The architecture is designed for testability:
- Browser APIs abstracted for easy mocking
- Services accept dependencies via constructor
- Pure functions where possible
- Clear interfaces and types

## Best Practices

The refactored code follows these best practices:

1. **Single Responsibility Principle**: Each class/module has one clear purpose
2. **Open/Closed Principle**: Easy to extend without modifying existing code
3. **Dependency Inversion**: Depend on abstractions, not concrete implementations
4. **Don't Repeat Yourself**: Common functionality extracted to utilities
5. **Clear Error Handling**: Consistent error handling patterns
6. **Type Safety**: Full TypeScript type coverage
7. **Logging**: Structured, filterable logs
8. **Configuration**: Centralized, easy to modify
9. **Documentation**: Clear comments and documentation

## Migration Notes

The refactored code maintains the same functionality as the original but with:
- Better code organization
- Improved error handling
- Enhanced type safety
- Easier testing
- More maintainable structure
- Better performance (fewer redundant operations)

## Future Improvements

Potential enhancements:
- Add unit tests for services and handlers
- Implement metrics collection
- Add retry strategies for failed API calls
- Enhanced debugging tools
- Performance monitoring
- Better offline support


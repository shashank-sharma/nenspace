<script lang="ts">
  import { scale } from "svelte/transition"
  import { spring } from "svelte/motion"
  import { onMount, onDestroy } from "svelte"
  import { IslandNotificationService } from "../lib/services/island-notification.service"
  import { NetworkService } from "../lib/services/network.service"
  import { ApiLoadingService } from "../lib/services/api-loading.service"
  import { RealtimeService } from "../lib/services/realtime.service"
  import { HealthService } from "../lib/services/health.service"
  import { StatusDisplayService } from "../lib/services/status-display.service"
  import { TimerService, type Timer } from "../lib/services/timer.service"
  import { Clock } from "lucide-svelte"
  import {
    STATUS_INDICATOR_CONFIG,
    getStatusIndicatorState,
    shouldIconAnimate,
    type SystemStatus
  } from "../lib/utils/status-indicator.util"
  import { ISLAND_CONFIG } from "../lib/config/island.config"
  import {
    ISLAND_DIMENSIONS,
    ISLAND_ANIMATIONS,
    ISLAND_COLORS,
    ISLAND_TYPOGRAPHY,
    getContainerStyle,
    getInnerStyle,
    NOTIFICATION_CONTENT_STYLE,
    NOTIFICATION_ICON_STYLE,
    NOTIFICATION_TEXT_STYLE,
    DEFAULT_ICON_CONTAINER_STYLE,
    getDefaultIconStyle,
    type IslandStyleState
  } from "../lib/config/island-styles.config"
  import {
    loadPosition,
    savePosition,
    validatePosition,
    type Position
  } from "../lib/utils/draggable.util"
  import { createLogger } from "../lib/utils/logger.util"
  import TimerDisplay from "../lib/components/TimerDisplay.svelte"
  import { IslandService } from "../lib/services/island.service"
  import type { IslandState } from "../lib/types/island.types"
  import { showDemoActivityIsland } from "../lib/utils/island-demo.util"
  import type { IslandNotification } from "../lib/services/island-notification.service"
  import type { HealthStatus } from "../lib/services/health.service"
  import ErrorBoundary from "../lib/components/ErrorBoundary.svelte"
  import { getTabActivityTracker, type TabActivityState } from "../lib/utils/tab-activity-tracker.util"
  import { createMessageHandler } from "../lib/utils/status-indicator-message.util"
  import { startCollapseAnimation } from "../lib/utils/status-indicator-animation.util"
  import {
    checkPageNavigation,
    savePositionState,
    restorePositionState,
    saveNavigationState
  } from "../lib/utils/status-indicator-navigation.util"

  const logger = createLogger("[StatusIndicator]")

  const isBrowser = typeof globalThis.window !== "undefined"
  const runtimeApi = (() => {
    if (typeof (globalThis as any).browser !== 'undefined' && (globalThis as any).browser.runtime) {
      return (globalThis as any).browser.runtime
    }
    if (typeof (globalThis as any).chrome !== 'undefined' && (globalThis as any).chrome.runtime) {
      return (globalThis as any).chrome.runtime
    }
    return null
  })()

  let navigationId = 0
  // Initialize with margin so it's not at the very top-left corner
  let position: Position = { 
    x: ISLAND_DIMENSIONS.MARGIN, 
    y: ISLAND_DIMENSIONS.MARGIN 
  }
  let dragging = false
  let dragCleanup: (() => void) | null = null
  let isTabVisible = true
  let isTabActive = false
  let currentNotification: IslandNotification | null = null
  let backendStatus: HealthStatus | null = null
  let displayState = StatusDisplayService.getState()
  let activeTimers: Timer[] = []
  let customContentTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  let islandState: IslandState = IslandService.state
  let unsubscribeIsland: (() => void) | null = null
  let unsubscribeTimerUpdate: (() => void) | null = null
  let unsubscribeTimerExpiration: (() => void) | null = null
  let unsubscribeNotification: (() => void) | null = null
  let unsubscribeTabActivity: (() => void) | null = null
  let tabActivityState: TabActivityState | null = null
  let previousFocus: HTMLElement | null = null

  $: systemStatus = {
    isBackendDown:
      backendStatus?.lastChecked !== null && backendStatus?.connected === false,
    isOffline: NetworkService.isOffline,
    realtimeStatus: RealtimeService.connectionStatus,
    isApiLoading: ApiLoadingService.isLoading,
    realtimeConnected: RealtimeService.isConnected,
    backendError: backendStatus?.error,
    realtimeError: RealtimeService.connectionError
  } as SystemStatus

  $: statusState = getStatusIndicatorState(systemStatus)

  $: if (isBrowser && position) {
    savePositionState(position, navigationId)
  }

  // Spring animations for smooth width/height transitions
  let width = spring<number>(ISLAND_DIMENSIONS.CIRCLE_SIZE, {
    stiffness: ISLAND_ANIMATIONS.SPRING_STIFFNESS,
    damping: ISLAND_ANIMATIONS.SPRING_DAMPING
  })

  let height = spring<number>(ISLAND_DIMENSIONS.PILL_HEIGHT, {
    stiffness: ISLAND_ANIMATIONS.SPRING_STIFFNESS,
    damping: ISLAND_ANIMATIONS.SPRING_DAMPING
  })

  let collapseTimeout: ReturnType<typeof setTimeout> | null = null

  $: styleState = {
    width: $width,
    height: $height,
    isExpanded: islandState.isExpanded,
    hasNotification: !!currentNotification,
    hasView: !!islandState.currentView,
    isDragging: dragging,
    isVisible: isTabActive,
    backgroundColor: displayState.backgroundColor,
    positionX: position.x,
    positionY: position.y,
    useFitContent,
  } as IslandStyleState
  
  $: containerStyle = getContainerStyle(styleState)
  $: innerStyle = getInnerStyle(styleState)

  let lastNotificationId: string | null = null
  let isCollapsing = false

  function updateDimensions() {
    if (islandState.isExpanded && islandState.currentView) {
      if (collapseTimeout) {
        clearTimeout(collapseTimeout)
        collapseTimeout = null
      }
      isCollapsing = false
      width.set(islandState.expandedWidth)
      height.set(islandState.expandedHeight)
    } else if (currentNotification) {
      if (collapseTimeout) {
        clearTimeout(collapseTimeout)
        collapseTimeout = null
      }
      isCollapsing = false
      if (lastNotificationId !== currentNotification.id) {
        lastNotificationId = currentNotification.id
        width.set(ISLAND_CONFIG.DIMENSIONS.NOTIFICATION.width)
        height.set(ISLAND_CONFIG.DIMENSIONS.NOTIFICATION.height)
      }
    } else {
      if (lastNotificationId !== null && !isCollapsing) {
        lastNotificationId = null
        isCollapsing = true
        if (collapseTimeout) {
          clearTimeout(collapseTimeout)
        }
        const cleanup = startCollapseAnimation(width, height)
        collapseTimeout = setTimeout(() => {
          cleanup()
          isCollapsing = false
          collapseTimeout = null
        }, ISLAND_CONFIG.ANIMATION.COLLAPSE_DELAY)
      } else if (!isCollapsing) {
        if (useFitContent) {
          width.set(ISLAND_CONFIG.DIMENSIONS.COMPACT.width)
          height.set(displayState.dimensions.height)
        } else {
          const targetWidth = displayState.dimensions.width || ISLAND_CONFIG.DIMENSIONS.COMPACT.width
          width.set(targetWidth)
          height.set(displayState.dimensions.height)
        }
      }
    }
  }
  
  $: if (islandState || currentNotification || useFitContent || displayState.dimensions) {
    updateDimensions()
  }

  function handleTabActivityChange(state: TabActivityState): void {
    tabActivityState = state
    isTabVisible = state.isVisible
    isTabActive = state.isActive

    if (isTabVisible) {
      currentNotification = IslandNotificationService.current
      backendStatus = HealthService.status
      HealthService.startMonitoring()
      HealthService.resume()
    } else {
      HealthService.pause()
    }
  }

  function handleStatusClick() {
    if (islandState.currentView) {
      IslandService.toggle()
      if (islandState.isExpanded) {
        previousFocus = document.activeElement as HTMLElement
      } else if (previousFocus) {
        previousFocus.focus()
        previousFocus = null
      }
      return
    }

    if (systemStatus.isBackendDown) {
      IslandNotificationService.error(statusState.message, {
        duration: STATUS_INDICATOR_CONFIG.NOTIFICATION_DURATION
      })
    } else if (systemStatus.isOffline) {
      IslandNotificationService.error(statusState.message, {
        duration: STATUS_INDICATOR_CONFIG.NOTIFICATION_DURATION
      })
    } else if (systemStatus.realtimeStatus === "error") {
      IslandNotificationService.warning(statusState.message, {
        duration: STATUS_INDICATOR_CONFIG.NOTIFICATION_DURATION
      })
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (currentNotification) {
        IslandNotificationService.hide()
        event.preventDefault()
        event.stopPropagation()
      } else if (islandState.isExpanded && islandState.currentView) {
        IslandService.hide()
        if (previousFocus) {
          previousFocus.focus()
          previousFocus = null
        }
        event.preventDefault()
        event.stopPropagation()
      }
    }
  }

  function handleMouseDown(event: MouseEvent) {
    event.preventDefault()
    startDragging(event.clientX, event.clientY)
  }

  function handleTouchStart(event: TouchEvent) {
    event.preventDefault()
    startDragging(event.touches[0].clientX, event.touches[0].clientY)
  }

  function startDragging(startX: number, startY: number) {
    dragCleanup?.()

    dragging = true
    const startPosX = position.x
    const startPosY = position.y
    let hasMoved = false

    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging) return

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

      const deltaX = Math.abs(clientX - startX)
      const deltaY = Math.abs(clientY - startY)

      if (
        deltaX > STATUS_INDICATOR_CONFIG.DRAG.THRESHOLD ||
        deltaY > STATUS_INDICATOR_CONFIG.DRAG.THRESHOLD
      ) {
        hasMoved = true
      }

      const newX = startPosX + (clientX - startX)
      const newY = startPosY + (clientY - startY)

      position = validatePosition(
        { x: newX, y: newY },
        {
          width: STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH,
          height: STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT
        }
      )
    }

    const stopDragging = () => {
      dragging = false
      document.removeEventListener("mousemove", handleDragMove)
      document.removeEventListener("touchmove", handleDragMove)
      document.removeEventListener("mouseup", stopDragging)
      document.removeEventListener("touchend", stopDragging)

      if (!hasMoved) {
        handleStatusClick()
      } else {
        savePosition(STATUS_INDICATOR_CONFIG.STORAGE_KEY, position)
      }

      dragCleanup = null
    }

    document.addEventListener("mousemove", handleDragMove)
    document.addEventListener("touchmove", handleDragMove)
    document.addEventListener("mouseup", stopDragging)
    document.addEventListener("touchend", stopDragging)

    dragCleanup = stopDragging
  }

  $: useFitContent = displayState.content?.type === 'timer' || displayState.dimensions.width === 0

  let updateDisplayStateTimeout: ReturnType<typeof setTimeout> | null = null

  function updateDisplayState(): void {
    if (updateDisplayStateTimeout) {
      clearTimeout(updateDisplayStateTimeout)
    }

    updateDisplayStateTimeout = setTimeout(() => {
      activeTimers = TimerService.activeTimers

      if (activeTimers.length > 0) {
        const firstTimer = activeTimers[0]
        const timerContent = {
          id: `timer-display-${firstTimer.id}`,
          type: 'timer' as const,
          mode: 'timer' as const,
          priority: 10,
          timerId: firstTimer.id,
          dimensions: {
            width: 0,
            height: STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT,
            borderRadius: '20px',
          },
        }
        StatusDisplayService.showTimer(timerContent)
      } else {
        StatusDisplayService.hideTimer()
      }

      displayState = StatusDisplayService.getState()
      updateDisplayStateTimeout = null
    }, ISLAND_CONFIG.TIMING.DISPLAY_STATE_UPDATE_DEBOUNCE)
  }

  $: if (TimerService.activeTimers) {
    updateDisplayState()
  }

  let lastStatusPriority = 0
  let hasShownNotification = false

  $: {
    if (statusState.priority !== lastStatusPriority) {
      lastStatusPriority = statusState.priority
      hasShownNotification = false
    }

    if (!hasShownNotification && !currentNotification) {
      if (systemStatus.isBackendDown) {
        IslandNotificationService.error(statusState.message, { duration: 3000 })
        hasShownNotification = true
      } else if (systemStatus.isOffline) {
        IslandNotificationService.error(statusState.message, { duration: 3000 })
        hasShownNotification = true
      } else if (systemStatus.realtimeStatus === "error") {
        IslandNotificationService.warning(statusState.message, { duration: 3000 })
        hasShownNotification = true
      }
    }
  }

  $: if (currentNotification) {
    const notificationContent: any = {
      id: currentNotification.id,
      type: 'text' as const,
      mode: 'notification' as const,
      priority: 20,
      text: currentNotification.message,
      backgroundColor: currentNotification.backgroundColor,
      textColor: currentNotification.textColor,
    }
    if (currentNotification.icon) {
      notificationContent.icon = currentNotification.icon
    }
    StatusDisplayService.showNotification(notificationContent, {
      duration: currentNotification.duration,
    })
    displayState = StatusDisplayService.getState()
  } else {
    StatusDisplayService.hideNotification()
    displayState = StatusDisplayService.getState()
  }

  onMount(() => {
    if (!isBrowser) return undefined

    try {
      function setupAutoDismiss(contentId: string, duration: number | undefined) {
        const existingTimer = customContentTimers.get(contentId)
        if (existingTimer) {
          clearTimeout(existingTimer)
        }

        if (duration && duration > 0) {
          const timer = setTimeout(() => {
            StatusDisplayService.hideCustom(contentId)
            customContentTimers.delete(contentId)
            displayState = StatusDisplayService.getState()
          }, duration)
          customContentTimers.set(contentId, timer)
        }
      }

      const handleRuntimeMessage = createMessageHandler({
        setupAutoDismiss,
        onDisplayUpdated: () => {
          displayState = StatusDisplayService.getState()
        }
      })

      runtimeApi?.onMessage?.addListener(handleRuntimeMessage)

      const isNavigation = checkPageNavigation()

      if (isNavigation) {
        const restoredPosition = restorePositionState()
        if (restoredPosition) {
          position = restoredPosition
        }
      } else {
        const defaultPosition: Position = {
          x: STATUS_INDICATOR_CONFIG.DIMENSIONS.MARGIN_LEFT,
          y: STATUS_INDICATOR_CONFIG.DIMENSIONS.MARGIN_TOP
        }

        position = loadPosition(
          STATUS_INDICATOR_CONFIG.STORAGE_KEY,
          {
            width: STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH,
            height: STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT
          },
          defaultPosition
        )
      }

      const elementSize = {
        width: STATUS_INDICATOR_CONFIG.DIMENSIONS.EXPANDED_WIDTH,
        height: STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT
      }

      const handleResize = () => {
        position = validatePosition(position, elementSize)
      }

      const handleBeforeUnload = () => {
        savePositionState(position, navigationId)
      }

      window.addEventListener("resize", handleResize)
      window.addEventListener("beforeunload", handleBeforeUnload)

      const tabActivityTracker = getTabActivityTracker()
      unsubscribeTabActivity = tabActivityTracker.subscribe(handleTabActivityChange)
      tabActivityState = tabActivityTracker.getState()
      handleTabActivityChange(tabActivityState)

      unsubscribeTimerUpdate = TimerService.onUpdate(() => {
        updateDisplayState()
      })

      unsubscribeTimerExpiration = TimerService.onExpiration(() => {
        updateDisplayState()
      })

      unsubscribeIsland = IslandService.subscribe((state) => {
        islandState = { ...state }
      })

      unsubscribeNotification = IslandNotificationService.subscribe((notification) => {
        currentNotification = notification
      })

      islandState = { ...IslandService.state }
      backendStatus = HealthService.status
      updateDisplayState()

      if (typeof window !== 'undefined') {
        (window as any).__showDemoActivityIsland = () => {
          showDemoActivityIsland()
        }
      }

      const handlePopState = () => {
        saveNavigationState(navigationId, true)
      }

      const handlePageShow = (event: PageTransitionEvent) => {
        if (event.persisted) {
          const tabActivityTracker = getTabActivityTracker()
          tabActivityState = tabActivityTracker.getState()
          handleTabActivityChange(tabActivityState)
          saveNavigationState(navigationId, true)
        }
      }

      window.addEventListener("popstate", handlePopState)
      window.addEventListener("pageshow", handlePageShow)

      if (isTabVisible) {
        HealthService.startMonitoring()
      }

      return () => {
        window.removeEventListener("resize", handleResize)
        window.removeEventListener("beforeunload", handleBeforeUnload)
        window.removeEventListener("popstate", handlePopState)
        window.removeEventListener("pageshow", handlePageShow)

        if (unsubscribeTabActivity) {
          unsubscribeTabActivity()
        }
        try {
          runtimeApi?.onMessage?.removeListener(handleRuntimeMessage)
        } catch {}
        if (unsubscribeTimerUpdate) {
          unsubscribeTimerUpdate()
        }
        if (unsubscribeTimerExpiration) {
          unsubscribeTimerExpiration()
        }
        if (unsubscribeIsland) {
          unsubscribeIsland()
        }
        if (unsubscribeNotification) {
          unsubscribeNotification()
        }
        customContentTimers.forEach(timer => clearTimeout(timer))
        customContentTimers.clear()
        if (updateDisplayStateTimeout) {
          clearTimeout(updateDisplayStateTimeout)
        }
      }
    } catch (error) {
      logger.error("Failed to mount", error)
      return undefined
    }
  })

  onDestroy(() => {
    if (collapseTimeout) {
      clearTimeout(collapseTimeout)
      collapseTimeout = null
    }
    dragCleanup?.()
    HealthService.stopMonitoring()
    NetworkService.cleanup()
  })
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- Island Container: Fixed position floating element -->
<div
  class="island-container"
  style={containerStyle}
  role="button"
  tabindex="0"
  aria-label="Dynamic Island - {statusState.message}"
  title={statusState.message}
  aria-live="polite"
  aria-expanded={islandState.isExpanded}
  on:mousedown={handleMouseDown}
  on:touchstart={handleTouchStart}>
  
  <!-- Island Inner: The visible pill/circle -->
  <div class="island-inner" style={innerStyle}>
    {#if islandState.isExpanded && islandState.currentView}
      <ErrorBoundary fallback="Notification unavailable">
        <svelte:component
          this={islandState.currentView.component}
          {...(islandState.currentView.props || {})}
        />
      </ErrorBoundary>
    {:else if displayState.content}
      {#if displayState.content.type === 'timer'}
        <TimerDisplay timerId={displayState.content.timerId} />
      {:else if displayState.content.type === 'text' && displayState.mode === 'notification'}
        {#if currentNotification}
          {@const notificationContent = displayState.content}
          {@const IconComponent = currentNotification.icon}
          {@const isLoading = currentNotification.variant === "loading"}
          {@const isError = currentNotification.variant === "error"}
          {#key currentNotification.id}
            <div
              style={NOTIFICATION_CONTENT_STYLE}
              role="alert"
              aria-live={isError ? "assertive" : "polite"}
              aria-atomic="true"
              aria-label="Notification: {currentNotification.message || ''}">
              {#if IconComponent}
                <div style={NOTIFICATION_ICON_STYLE} aria-hidden="true">
                  <svelte:component
                    this={IconComponent}
                    size={ISLAND_TYPOGRAPHY.ICON_SIZE}
                    class="{isLoading ? 'nenspace-animate-spin' : ''}" />
                </div>
              {/if}
              <div style={NOTIFICATION_TEXT_STYLE}>
                {notificationContent.text}
              </div>
            </div>
          {/key}
        {/if}
      {:else if displayState.content.type === 'image'}
        {@const imageContent = displayState.content}
        <div class="nenspace-island-image-content nenspace-flex nenspace-items-center nenspace-justify-center nenspace-h-full nenspace-w-full nenspace-p-2">
          <img
            src={imageContent.src || ''}
            alt={imageContent.alt || 'Status indicator image'}
            class="nenspace-island-image nenspace-max-w-full nenspace-max-h-full nenspace-object-contain nenspace-rounded"
            loading="lazy" />
        </div>
      {:else if displayState.content.type === 'chart'}
        {@const chartContent = displayState.content}
        <div class="nenspace-island-chart-content nenspace-flex nenspace-items-center nenspace-justify-center nenspace-h-full nenspace-w-full nenspace-p-4">
          <div class="nenspace-island-chart-inner nenspace-text-center">
            <div class="nenspace-island-chart-title nenspace-text-xs nenspace-text-gray-300 nenspace-mb-2">Chart: {chartContent.chartType || 'line'}</div>
            <div class="nenspace-island-chart-placeholder nenspace-text-xs nenspace-text-gray-400">Chart library integration pending</div>
          </div>
        </div>
      {:else if displayState.content.type === 'component'}
        {@const componentContent = displayState.content}
        {#if componentContent.component}
          <div class="nenspace-island-component-content nenspace-flex nenspace-items-center nenspace-justify-center nenspace-h-full nenspace-w-full">
            <svelte:component this={componentContent.component} {...(componentContent.props || {})} />
          </div>
        {:else}
          <div class="nenspace-island-component-content nenspace-flex nenspace-items-center nenspace-justify-center nenspace-h-full nenspace-w-full nenspace-p-4">
            <div class="nenspace-island-component-placeholder nenspace-text-xs nenspace-text-gray-400">Component not available</div>
          </div>
        {/if}
      {/if}
    {:else}
      <!-- Default state: show status icon centered -->
      {@const StatusIcon = statusState.icon}
      <div style={DEFAULT_ICON_CONTAINER_STYLE} in:scale={{ duration: 300, start: 1.1 }}>
        {#if StatusIcon}
          <div style={getDefaultIconStyle(statusState.iconColor)}>
            <svelte:component
              this={StatusIcon}
              size={ISLAND_TYPOGRAPHY.ICON_SIZE}
              class="{shouldIconAnimate(systemStatus) ? 'nenspace-animate-spin' : ''}" />
          </div>
        {:else}
          <div style={getDefaultIconStyle(ISLAND_COLORS.TEXT_MUTED)}>
            <Clock size={ISLAND_TYPOGRAPHY.ICON_SIZE} />
          </div>
        {/if}
      </div>
    {/if}

    {#if systemStatus.isApiLoading && !currentNotification}
      <div class="nenspace-island-shimmer nenspace-absolute nenspace-inset-0 nenspace-pointer-events-none"></div>
    {/if}
  </div>
</div>

<style>
</style>

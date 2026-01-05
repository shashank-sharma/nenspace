import { createLogger } from './logger.util'
import { RealtimeService } from '../services/realtime.service'
import { IslandNotificationService } from '../services/island-notification.service'
import { StatusDisplayService } from '../services/status-display.service'
import { getTabActivityTracker } from './tab-activity-tracker.util'
import type { StatusDisplayMessage } from '../types/messages'
import type {
  ImageContent,
  ChartContent,
  ComponentContent,
  StatusDisplayContent
} from '../types/status-display.types'
import { STATUS_INDICATOR_CONFIG } from './status-indicator.util'

const logger = createLogger('[StatusIndicatorMessage]')

export interface MessageHandlerOptions {
  onNotificationShown?: () => void
  onDisplayUpdated?: () => void
  setupAutoDismiss?: (contentId: string, duration: number | undefined) => void
}

export function createMessageHandler(options: MessageHandlerOptions = {}) {
  const { setupAutoDismiss, onDisplayUpdated } = options

  return (message: any) => {
    if (!message || typeof message !== 'object') return

    if (message.type === 'REALTIME_STATUS') {
      const payload = message.payload || {}
      try {
        RealtimeService.setStatus?.(payload.status, payload.error)
      } catch (error) {
        logger.warn('Failed to set realtime status', error)
      }
      return
    }

    if (message.type === 'REALTIME_NOTIFICATION') {
      handleRealtimeNotification(message)
      return
    }

    if (message.type === 'STATUS_DISPLAY') {
      handleStatusDisplay(message as StatusDisplayMessage, setupAutoDismiss, onDisplayUpdated)
      return
    }
  }
}

function handleRealtimeNotification(message: any): void {
  const n = message.payload || {}
  const currentState = getTabActivityTracker().getState()

  if (!n.message) return

  if (!currentState.isVisible) {
    logger.debug('Ignoring notification - tab is hidden', {
      isTabActive: currentState.isActive,
      isTabVisible: currentState.isVisible,
      url: window.location.href?.substring(0, 50)
    })
    return
  }

  try {
    const variant = n.variant || 'info'
    IslandNotificationService.show(n.message, variant, {
      duration: n.duration ?? 3000
    })
  } catch (error) {
    logger.error('Failed to show notification', {
      error: error instanceof Error ? error.message : error,
      notification: n.message?.substring(0, 50)
    })
  }
}

function handleStatusDisplay(
  displayMsg: StatusDisplayMessage,
  setupAutoDismiss?: (contentId: string, duration: number | undefined) => void,
  onDisplayUpdated?: () => void
): void {
  const { content, dimensions, options } = displayMsg.payload || {}

  if (!content) {
    logger.warn('STATUS_DISPLAY message missing content')
    return
  }

  try {
    const displayContent: StatusDisplayContent = {
      id: content.id,
      type: content.type,
      mode: content.mode || 'custom',
      priority: options?.priority ?? 30,
      dimensions: dimensions
        ? {
            width: dimensions.width ?? 0,
            height: dimensions.height ?? STATUS_INDICATOR_CONFIG.DIMENSIONS.HEIGHT,
            borderRadius: dimensions.borderRadius ?? '20px'
          }
        : undefined,
      ...(content.type === 'text' && {
        text: content.text || '',
        backgroundColor: options?.backgroundColor || content.backgroundColor,
        textColor: content.textColor
      }),
      ...(content.type === 'image' && {
        src: content.src || '',
        alt: content.alt
      }),
      ...(content.type === 'chart' && {
        chartType: content.chartType || 'line',
        data: content.chartData
      }),
      ...(content.type === 'component' && {
        component: null as any,
        props: content.componentProps
      }),
      ...(content.type === 'timer' && {
        timerId: content.timerId || ''
      })
    } as StatusDisplayContent

    if (content.type === 'text') {
      StatusDisplayService.showNotification(displayContent, options)
    } else if (content.type === 'image') {
      StatusDisplayService.showImage(displayContent as ImageContent, options)
      setupAutoDismiss?.(content.id, options?.duration)
    } else if (content.type === 'chart') {
      StatusDisplayService.showChart(displayContent as ChartContent, options)
      setupAutoDismiss?.(content.id, options?.duration)
    } else if (content.type === 'component') {
      StatusDisplayService.showComponent(displayContent as ComponentContent, options)
      setupAutoDismiss?.(content.id, options?.duration)
    } else if (content.type === 'timer') {
      StatusDisplayService.showTimer(displayContent)
    }

    onDisplayUpdated?.()
    logger.debug('Status display updated', { type: content.type, id: content.id })
  } catch (error) {
    logger.error('Failed to process STATUS_DISPLAY message', error)
  }
}


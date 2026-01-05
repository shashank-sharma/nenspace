import { parseTime, formatTime, type ParsedTime } from '../utils/time-parser.util';
import { playNotificationSound } from '../utils/sound.util';
import { IslandNotificationService } from './island-notification.service';
import { createLogger } from '../utils/logger.util';

const logger = createLogger('[TimerService]');

export interface Timer {
  id: string;
  label?: string;
  duration: number;
  remaining: number;
  startTime: number;
  isActive: boolean;
  isPaused: boolean;
  pausedAt?: number;
  accumulatedPauseTime: number;
}

export type TimerExpirationCallback = (timer: Timer) => void;
export type TimerUpdateCallback = (timer: Timer) => void;

class TimerServiceImpl {
  #timers: Map<string, Timer> = new Map();
  #intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  #expirationCallbacks: Set<TimerExpirationCallback> = new Set();
  #updateCallbacks: Set<TimerUpdateCallback> = new Set();

  get activeTimers(): Timer[] {
    return Array.from(this.#timers.values()).filter(t => t.isActive && !t.isPaused);
  }

  get allTimers(): Timer[] {
    return Array.from(this.#timers.values());
  }

  getTimer(id: string): Timer | undefined {
    return this.#timers.get(id);
  }

  onExpiration(callback: TimerExpirationCallback): () => void {
    this.#expirationCallbacks.add(callback);
    return () => {
      this.#expirationCallbacks.delete(callback);
    };
  }

  onUpdate(callback: TimerUpdateCallback): () => void {
    this.#updateCallbacks.add(callback);
    return () => {
      this.#updateCallbacks.delete(callback);
    };
  }

  startTimer(durationString: string, label?: string): string | null {
    const parsed = parseTime(durationString);
    
    if (!parsed.isValid) {
      logger.error('Failed to parse timer duration', { input: durationString, error: parsed.error });
      return null;
    }

    if (parsed.seconds <= 0) {
      logger.warn('Timer duration must be greater than 0', { seconds: parsed.seconds });
      return null;
    }

    const id = `timer_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const now = Date.now();

    const timer: Timer = {
      id,
      label,
      duration: parsed.seconds,
      remaining: parsed.seconds,
      startTime: now,
      isActive: true,
      isPaused: false,
      accumulatedPauseTime: 0,
    };

    this.#timers.set(id, timer);
    this.#startTimerTick(id);

    logger.info('Timer started', { id, duration: parsed.seconds, label, formatted: formatTime(parsed.seconds) });

    return id;
  }

  stopTimer(id: string): boolean {
    const timer = this.#timers.get(id);
    if (!timer) {
      logger.warn('Timer not found', { id });
      return false;
    }

    this.#clearTimerInterval(id);
    
    timer.isActive = false;
    this.#timers.set(id, timer);

    this.#notifyUpdate(timer);

    logger.info('Timer stopped', { id });
    return true;
  }

  pauseTimer(id: string): boolean {
    const timer = this.#timers.get(id);
    if (!timer || !timer.isActive || timer.isPaused) {
      return false;
    }

    this.#clearTimerInterval(id);
    
    timer.isPaused = true;
    timer.pausedAt = Date.now();
    this.#timers.set(id, timer);

    this.#notifyUpdate(timer);

    logger.info('Timer paused', { id });
    return true;
  }

  resumeTimer(id: string): boolean {
    const timer = this.#timers.get(id);
    if (!timer || !timer.isActive || !timer.isPaused) {
      return false;
    }

    if (timer.pausedAt) {
      timer.accumulatedPauseTime += Date.now() - timer.pausedAt;
      timer.pausedAt = undefined;
    }

    timer.isPaused = false;
    this.#timers.set(id, timer);

    this.#startTimerTick(id);
    this.#notifyUpdate(timer);

    logger.info('Timer resumed', { id });
    return true;
  }

  clearTimer(id: string): boolean {
    this.#clearTimerInterval(id);
    const removed = this.#timers.delete(id);
    
    if (removed) {
      logger.info('Timer cleared', { id });
    }
    
    return removed;
  }

  clearAllTimers(): void {
    this.#intervals.forEach((interval, id) => {
      clearInterval(interval);
    });
    this.#intervals.clear();
    this.#timers.clear();
    
    logger.info('All timers cleared');
  }

  getFormattedTime(id: string): string {
    const timer = this.#timers.get(id);
    if (!timer) {
      return '0s';
    }

    let remaining = timer.remaining;
    
    if (timer.isActive && !timer.isPaused) {
      const now = Date.now();
      const elapsed = (now - timer.startTime - timer.accumulatedPauseTime) / 1000;
      remaining = Math.max(0, timer.duration - Math.floor(elapsed));
    }

    return formatTime(remaining);
  }

  getRemainingSeconds(id: string): number {
    const timer = this.#timers.get(id);
    if (!timer) {
      return 0;
    }

    if (timer.isActive && !timer.isPaused) {
      const now = Date.now();
      const elapsed = (now - timer.startTime - timer.accumulatedPauseTime) / 1000;
      return Math.max(0, timer.duration - Math.floor(elapsed));
    }

    return timer.remaining;
  }

  #startTimerTick(id: string): void {
    this.#clearTimerInterval(id);

    let lastUpdate = Date.now();
    const updateInterval = 100;

    const updateTimer = () => {
      const now = Date.now();
      const timer = this.#timers.get(id);
      
      if (!timer || !timer.isActive || timer.isPaused) {
        return;
      }

      if (now - lastUpdate < updateInterval) {
        requestAnimationFrame(updateTimer);
        return;
      }

      lastUpdate = now;

      const elapsed = (now - timer.startTime - timer.accumulatedPauseTime) / 1000;
      const remaining = Math.max(0, timer.duration - Math.floor(elapsed));

      timer.remaining = remaining;
      this.#timers.set(id, timer);

      this.#notifyUpdate(timer);

      if (remaining <= 0) {
        this.#handleExpiration(timer);
        return;
      }

      requestAnimationFrame(updateTimer);
    };

    requestAnimationFrame(updateTimer);
    
    const fallbackInterval = setInterval(() => {
      const timer = this.#timers.get(id);
      if (!timer || !timer.isActive || timer.isPaused) {
        clearInterval(fallbackInterval);
        this.#intervals.delete(id);
        return;
      }
      updateTimer();
    }, updateInterval);

    this.#intervals.set(id, fallbackInterval);
  }

  #clearTimerInterval(id: string): void {
    const interval = this.#intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.#intervals.delete(id);
    }
  }

  async #handleExpiration(timer: Timer): Promise<void> {
    this.#clearTimerInterval(timer.id);
    
    timer.isActive = false;
    timer.remaining = 0;
    this.#timers.set(timer.id, timer);

    this.#expirationCallbacks.forEach(callback => {
      try {
        callback(timer);
      } catch (error) {
        logger.error('Error in expiration callback', error);
      }
    });

    try {
      await playNotificationSound();
    } catch (error) {
      logger.warn('Failed to play expiration sound', error);
    }

    const labelText = timer.label ? ` "${timer.label}"` : '';
    IslandNotificationService.info(`Timer${labelText} completed!`, {
      duration: 5000
    });

    logger.info('Timer expired', { id: timer.id, label: timer.label });
  }

  #notifyUpdate(timer: Timer): void {
    this.#updateCallbacks.forEach(callback => {
      try {
        callback(timer);
      } catch (error) {
        logger.error('Error in update callback', error);
      }
    });
  }
}

export const TimerService = new TimerServiceImpl();

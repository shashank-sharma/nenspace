<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Timer } from 'lucide-svelte';
  import { TimerService, type Timer as TimerData } from '../services/timer.service';
  import { createLogger } from '../utils/logger.util';

  const logger = createLogger('[TimerDisplay]');

  export let timerId: string;

  let timer: TimerData | null = null;
  let formattedTime = '0s';
  let updateInterval: ReturnType<typeof setInterval> | null = null;
  let showStopButton = false;

  // Subscribe to timer updates
  let unsubscribeUpdate: (() => void) | null = null;

  function handleStop() {
    logger.debug('Stop button clicked', { timerId });
    TimerService.stopTimer(timerId);
  }

  function updateDisplay() {
    if (!timer || !timer.isActive) {
      formattedTime = '0s';
      return;
    }

    formattedTime = TimerService.getFormattedTime(timerId);
  }

  onMount(() => {
    const foundTimer = TimerService.getTimer(timerId);
    timer = foundTimer ?? null;
    
    if (!timer) {
      logger.warn('Timer not found', { timerId });
      return;
    }

    // Subscribe to timer updates
    unsubscribeUpdate = TimerService.onUpdate((updatedTimer) => {
      if (updatedTimer.id === timerId) {
        timer = updatedTimer;
        updateDisplay();
        
        // If timer expired or stopped, cleanup
        if (!timer.isActive) {
          if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
          }
        }
      }
    });

    // Initial update
    updateDisplay();

    // Use requestAnimationFrame for smoother updates with better performance
    let lastUpdate = Date.now();
    const updateRate = 100; // Update every 100ms
    
    const updateLoop = () => {
      const now = Date.now();
      if (now - lastUpdate >= updateRate) {
        updateDisplay();
        lastUpdate = now;
      }
      updateInterval = requestAnimationFrame(updateLoop) as any;
    };
    
    updateInterval = requestAnimationFrame(updateLoop) as any;
  });

  onDestroy(() => {
    if (updateInterval) {
      if (typeof updateInterval === 'number') {
        cancelAnimationFrame(updateInterval);
      } else {
        clearInterval(updateInterval);
      }
    }
    if (unsubscribeUpdate) {
      unsubscribeUpdate();
    }
  });

  // Update when timer changes
  $: if (timer) {
    updateDisplay();
  }
</script>

<div class="timer-display">
  <div class="timer-content">
    <!-- Timer Icon / Stop Button (combined) -->
    <button
      class="timer-icon-button"
      on:click={handleStop}
      on:mouseenter={() => showStopButton = true}
      on:mouseleave={() => showStopButton = false}
      aria-label="Stop timer"
      title="Stop timer">
      {#if showStopButton}
        <div class="stop-button-inner"></div>
      {:else}
        <Timer size={18} />
      {/if}
    </button>

    <!-- Timer Text -->
    <div class="timer-text">
      {#if timer?.label}
        <div class="timer-label">{timer.label}</div>
      {/if}
      <div class="timer-time">{formattedTime}</div>
    </div>
  </div>
</div>

<!-- 
  CRITICAL: NO CSS in <style> tags for CSUI child components!
  All styles are injected via getStyle API into Shadow DOM ONLY.
  This prevents CSS from leaking to the page.
  
  Styles are defined in: src/lib/utils/csui-child-components-styles.util.ts
  Function: getTimerDisplayStyles()
-->

<style>
  /* All styles moved to getStyle API - prevents CSS leaking to page */
  /* See csui-child-components-styles.util.ts - getTimerDisplayStyles() */
</style>

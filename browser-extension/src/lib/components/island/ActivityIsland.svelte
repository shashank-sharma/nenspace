<script lang="ts">
  import type { ActivityIslandProps } from '../../types/island.types';
  import { X, Globe, Clock, ExternalLink } from 'lucide-svelte';
  import { fade } from 'svelte/transition';
  import { ISLAND_CONFIG } from '../../config/island.config';

  export let activity: ActivityIslandProps['activity'];
  export let onClose: ActivityIslandProps['onClose'];

  function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) return `${minutes}m ${secs}s`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  function formatTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  }

  import { isValidFaviconUrl } from '../../utils/sanitize.util';

  function getDomainIcon(domain: string): string {
    try {
      const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      // Validate URL before returning
      return isValidFaviconUrl(url) ? url : '';
    } catch {
      return '';
    }
  }

  function handleClose(): void {
    onClose?.();
  }

  function openUrl(): void {
    if (activity.url && activity.url !== 'test') {
      try {
        window.open(activity.url, '_blank');
      } catch (error) {
        console.warn('Could not open URL:', error);
      }
    }
  }
</script>

<div
  class="w-full h-full flex flex-col overflow-hidden box-border text-white"
  style="padding: {ISLAND_CONFIG.SPACING.PADDING}px; gap: {ISLAND_CONFIG.SPACING.GAP}px;"
  role="region"
  aria-label="Activity information: {activity.title || activity.domain || 'Unknown'}"
  transition:fade={{ duration: 200 }}>
  <div class="flex items-start justify-between flex-shrink-0 min-h-0" style="gap: {ISLAND_CONFIG.SPACING.HEADER_GAP}px;">
    <div class="flex items-center flex-1 min-w-0" style="gap: {ISLAND_CONFIG.SPACING.HEADER_GAP}px;">
      {#if activity.domain}
        <img
          src={getDomainIcon(activity.domain)}
          alt={activity.domain}
          class="rounded flex-shrink-0"
          style="width: {ISLAND_CONFIG.ICONS.DOMAIN}px; height: {ISLAND_CONFIG.ICONS.DOMAIN}px;"
          onerror="this.style.display='none'"
        />
      {/if}
      <div class="flex-1 min-w-0">
        <div
          class="text-white whitespace-nowrap overflow-hidden text-ellipsis"
          style="font-size: {ISLAND_CONFIG.TYPOGRAPHY.TITLE.size}px; font-weight: {ISLAND_CONFIG.TYPOGRAPHY.TITLE.weight}; line-height: {ISLAND_CONFIG.TYPOGRAPHY.TITLE.lineHeight};">
          {activity.title || activity.domain || 'Unknown'}
        </div>
        <div
          class="text-white/70 whitespace-nowrap overflow-hidden text-ellipsis"
          style="font-size: {ISLAND_CONFIG.TYPOGRAPHY.DOMAIN.size}px; line-height: {ISLAND_CONFIG.TYPOGRAPHY.DOMAIN.lineHeight}; margin-top: 1px;">
          {activity.domain || activity.url}
        </div>
      </div>
    </div>
    <button
      class="bg-transparent border-none text-white/70 cursor-pointer flex items-center justify-center rounded transition-all flex-shrink-0 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-black"
      style="padding: 2px; width: 18px; height: 18px; min-width: 18px; min-height: 18px;"
      on:click={handleClose}
      aria-label="Close activity view">
      <X size={ISLAND_CONFIG.ICONS.CLOSE} aria-hidden="true" />
    </button>
  </div>

  <div class="flex flex-col flex-1 min-h-0 overflow-hidden" style="gap: {ISLAND_CONFIG.SPACING.GAP}px;">
    <div class="flex" style="gap: {ISLAND_CONFIG.SPACING.STATS_GAP}px;">
      <div class="flex items-center" style="gap: 4px;">
        <Clock size={ISLAND_CONFIG.ICONS.STAT} class="text-white/60 flex-shrink-0" />
        <span
          class="text-white"
          style="font-size: {ISLAND_CONFIG.TYPOGRAPHY.STAT_VALUE.size}px; font-weight: {ISLAND_CONFIG.TYPOGRAPHY.STAT_VALUE.weight};">
          {formatDuration(activity.duration)}
        </span>
        <span
          class="text-white/60"
          style="font-size: {ISLAND_CONFIG.TYPOGRAPHY.STAT_LABEL.size}px;">
          Duration
        </span>
      </div>
      <div class="flex items-center" style="gap: 4px;">
        <Globe size={ISLAND_CONFIG.ICONS.STAT} class="text-white/60 flex-shrink-0" />
        <span
          class="text-white"
          style="font-size: {ISLAND_CONFIG.TYPOGRAPHY.STAT_VALUE.size}px; font-weight: {ISLAND_CONFIG.TYPOGRAPHY.STAT_VALUE.weight};">
          {formatTime(activity.start_time)}
        </span>
        <span
          class="text-white/60"
          style="font-size: {ISLAND_CONFIG.TYPOGRAPHY.STAT_LABEL.size}px;">
          Started
        </span>
      </div>
    </div>

    {#if activity.end_time}
      <div class="flex items-center text-white/70" style="gap: 4px; font-size: {ISLAND_CONFIG.TYPOGRAPHY.TIME_RANGE.size}px;">
        <span class="text-white/50">From</span>
        <span class="text-white/90 font-medium">{formatTime(activity.start_time)}</span>
        <span class="text-white/40">→</span>
        <span class="text-white/90 font-medium">{formatTime(activity.end_time)}</span>
      </div>
    {/if}

    <div class="flex flex-wrap" style="gap: 4px;">
      {#if activity.audible}
        <span
          class="text-white/80 rounded leading-tight"
          style="font-size: {ISLAND_CONFIG.TYPOGRAPHY.META_BADGE.size}px; padding: {ISLAND_CONFIG.TYPOGRAPHY.META_BADGE.padding}; background: {ISLAND_CONFIG.COLORS.BADGE_BG}; border-radius: {ISLAND_CONFIG.TYPOGRAPHY.META_BADGE.borderRadius};">
          🔊 Audio
        </span>
      {/if}
      {#if activity.incognito}
        <span
          class="text-white/80 rounded leading-tight"
          style="font-size: {ISLAND_CONFIG.TYPOGRAPHY.META_BADGE.size}px; padding: {ISLAND_CONFIG.TYPOGRAPHY.META_BADGE.padding}; background: {ISLAND_CONFIG.COLORS.BADGE_BG}; border-radius: {ISLAND_CONFIG.TYPOGRAPHY.META_BADGE.borderRadius};">
          🔒 Incognito
        </span>
      {/if}
      <span
        class="text-white/80 rounded leading-tight"
        style="font-size: {ISLAND_CONFIG.TYPOGRAPHY.META_BADGE.size}px; padding: {ISLAND_CONFIG.TYPOGRAPHY.META_BADGE.padding}; background: {ISLAND_CONFIG.COLORS.BADGE_BG}; border-radius: {ISLAND_CONFIG.TYPOGRAPHY.META_BADGE.borderRadius};">
        Tab #{activity.tab_id}
        </span>
    </div>
  </div>

  <button
    class="flex items-center justify-center w-full flex-shrink-0 box-border text-white cursor-pointer transition-all hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-black"
    style="gap: 4px; padding: {ISLAND_CONFIG.TYPOGRAPHY.BUTTON.padding}; background: {ISLAND_CONFIG.COLORS.BUTTON_BG}; border: 1px solid {ISLAND_CONFIG.COLORS.BUTTON_BORDER}; border-radius: {ISLAND_CONFIG.TYPOGRAPHY.BUTTON.borderRadius}; font-size: {ISLAND_CONFIG.TYPOGRAPHY.BUTTON.size}px; font-weight: {ISLAND_CONFIG.TYPOGRAPHY.BUTTON.weight};"
    on:click={openUrl}
    aria-label="Open {activity.title || activity.domain || 'page'} in new tab">
    <ExternalLink size={ISLAND_CONFIG.ICONS.BUTTON} aria-hidden="true" />
    <span>Open</span>
  </button>
</div>

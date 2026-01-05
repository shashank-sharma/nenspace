<script lang="ts">
  import type { NotificationIslandProps } from '../../types/island.types';
  import { X } from 'lucide-svelte';
  import { fade } from 'svelte/transition';
  import { ISLAND_CONFIG } from '../../config/island.config';
  import type { ComponentType } from 'svelte';

  export let notification: NotificationIslandProps['notification'];
  export let onClose: NotificationIslandProps['onClose'];

  function handleClose(): void {
    onClose?.();
  }

  $: isError = notification.variant === 'error';
  $: ariaLive = isError ? 'assertive' : 'polite';
  $: iconComponent = notification.icon as ComponentType | undefined;
</script>

<div
  class="w-full h-full flex flex-col overflow-hidden box-border text-white"
  style="padding: {ISLAND_CONFIG.SPACING.PADDING}px; gap: {ISLAND_CONFIG.SPACING.GAP}px;"
  role="alert"
  aria-live={ariaLive}
  aria-atomic="true"
  aria-label="Notification: {notification.title || 'Notification'}"
  transition:fade={{ duration: 200 }}>
  <div class="flex items-center justify-between flex-shrink-0">
    <div class="flex items-center flex-1 min-w-0" style="gap: {ISLAND_CONFIG.SPACING.HEADER_GAP}px;">
      {#if iconComponent}
        <div class="flex-shrink-0" aria-hidden="true">
          <svelte:component this={iconComponent} size={ISLAND_CONFIG.ICONS.STAT} class="text-white/60" />
        </div>
      {/if}
      <div class="flex-1 min-w-0">
        <div
          class="text-white whitespace-nowrap overflow-hidden text-ellipsis"
          style="font-size: {ISLAND_CONFIG.TYPOGRAPHY.TITLE.size}px; font-weight: {ISLAND_CONFIG.TYPOGRAPHY.TITLE.weight}; line-height: {ISLAND_CONFIG.TYPOGRAPHY.TITLE.lineHeight};">
          {notification.title || 'Notification'}
        </div>
        {#if notification.message}
          <div
            class="text-white/70 line-clamp-2"
            style="font-size: {ISLAND_CONFIG.TYPOGRAPHY.DOMAIN.size}px; line-height: {ISLAND_CONFIG.TYPOGRAPHY.DOMAIN.lineHeight}; margin-top: 2px;">
            {notification.message}
          </div>
        {/if}
      </div>
    </div>
    <button
      class="bg-transparent border-none text-white/70 cursor-pointer flex items-center justify-center rounded transition-all flex-shrink-0 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-black"
      style="padding: 2px; width: 18px; height: 18px; min-width: 18px; min-height: 18px;"
      on:click={handleClose}
      aria-label="Close notification">
      <X size={ISLAND_CONFIG.ICONS.CLOSE} aria-hidden="true" />
    </button>
  </div>

  {#if notification.actions && notification.actions.length > 0}
    <div class="flex gap-2 flex-shrink-0">
      {#each notification.actions as action}
        {@const actionIcon = action.icon}
        <button
          class="flex items-center justify-center flex-1 cursor-pointer transition-all text-white focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-black"
          style="gap: 4px; padding: {ISLAND_CONFIG.TYPOGRAPHY.BUTTON.padding}; background: {ISLAND_CONFIG.COLORS.BUTTON_BG}; border: 1px solid {ISLAND_CONFIG.COLORS.BUTTON_BORDER}; border-radius: {ISLAND_CONFIG.TYPOGRAPHY.BUTTON.borderRadius}; font-size: {ISLAND_CONFIG.TYPOGRAPHY.BUTTON.size}px; font-weight: {ISLAND_CONFIG.TYPOGRAPHY.BUTTON.weight};"
          on:click={() => action.onClick?.()}
          aria-label={action.label || 'Action'}>
          {#if actionIcon}
            <svelte:component this={actionIcon} size={ISLAND_CONFIG.ICONS.BUTTON} aria-hidden="true" />
          {/if}
          {#if action.label}
            <span>{action.label}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>


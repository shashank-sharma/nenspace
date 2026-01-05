<script lang="ts">
  import type { ComponentType } from "svelte"

  export let icon: ComponentType | undefined = undefined
  export let title: string
  export let description: string | undefined = undefined
  export let actionLabel: string | undefined = undefined
  export let onAction: (() => void) | undefined = undefined
  export let compact = false
</script>

<div class="empty-state" class:compact>
  {#if icon}
    <div class="empty-icon">
      <svelte:component this={icon} size={compact ? 40 : 56} />
    </div>
  {/if}

  <div class="empty-content">
    <h3>{title}</h3>
    {#if description}
      <p>{description}</p>
    {/if}
  </div>

  {#if actionLabel && onAction}
    <button class="btn-action" on:click={onAction}>
      {actionLabel}
    </button>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 80px 20px;
    text-align: center;
  }

  .empty-state.compact {
    padding: 40px 20px;
    gap: 16px;
  }

  .empty-icon {
    color: var(--nenspace-text-muted, #888);
    opacity: 0.7;
  }

  .empty-content h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--nenspace-text-primary, #ffffff);
  }

  .compact .empty-content h3 {
    font-size: 15px;
    margin-bottom: 6px;
  }

  .empty-content p {
    font-size: 14px;
    color: var(--nenspace-text-secondary, #e5e7eb);
    margin: 0;
    max-width: 400px;
    line-height: 1.5;
  }

  .compact .empty-content p {
    font-size: 13px;
  }

  .btn-action {
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 600;
    background: var(--nenspace-accent-primary, #e88b8b);
    color: var(--nenspace-background, #1e2124);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 8px;
  }

  .compact .btn-action {
    padding: 8px 20px;
    font-size: 13px;
  }

  .btn-action:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
</style>

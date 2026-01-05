<script lang="ts">
  export let title = "Something went wrong"
  export let message: string | undefined = undefined
  export let onRetry: (() => void) | undefined = undefined
  export let onDismiss: (() => void) | undefined = undefined
  export let compact = false
</script>

<div class="error-state" class:compact>
  <div class="error-icon">
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  </div>

  <div class="error-content">
    <h3>{title}</h3>
    {#if message}
      <p>{message}</p>
    {/if}
  </div>

  {#if onRetry || onDismiss}
    <div class="error-actions">
      {#if onRetry}
        <button class="btn-retry" on:click={onRetry}> Try Again </button>
      {/if}
      {#if onDismiss}
        <button class="btn-dismiss" on:click={onDismiss}> Dismiss </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 60px 20px;
    text-align: center;
  }

  .error-state.compact {
    padding: 30px 20px;
    gap: 12px;
  }

  .error-icon {
    color: var(--nenspace-accent-primary, #e88b8b);
  }

  .compact .error-icon svg {
    width: 36px;
    height: 36px;
  }

  .error-content h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 6px 0;
    color: var(--nenspace-text-primary, #ffffff);
  }

  .compact .error-content h3 {
    font-size: 15px;
  }

  .error-content p {
    font-size: 14px;
    color: var(--nenspace-text-secondary, #e5e7eb);
    margin: 0;
    max-width: 400px;
  }

  .compact .error-content p {
    font-size: 13px;
  }

  .error-actions {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .btn-retry,
  .btn-dismiss {
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .compact .btn-retry,
  .compact .btn-dismiss {
    padding: 8px 16px;
    font-size: 13px;
  }

  .btn-retry {
    background: var(--nenspace-accent-primary, #e88b8b);
    color: var(--nenspace-background, #1e2124);
    font-weight: 600;
  }

  .btn-retry:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .btn-dismiss {
    background: var(--nenspace-input-bg, rgba(255, 255, 255, 0.05));
    color: var(--nenspace-text-primary, #ffffff);
    border: 1px solid var(--nenspace-border, rgba(255, 255, 255, 0.1));
  }

  .btn-dismiss:hover {
    background: var(--nenspace-hover-bg, rgba(255, 255, 255, 0.1));
  }
</style>

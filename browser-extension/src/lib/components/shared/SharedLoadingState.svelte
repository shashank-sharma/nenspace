<script lang="ts">
  export let message = "Loading..."
  export let size: "small" | "medium" | "large" = "medium"

  const sizes = {
    small: { spinner: 20, padding: "20px", fontSize: "13px" },
    medium: { spinner: 28, padding: "40px 20px", fontSize: "14px" },
    large: { spinner: 36, padding: "60px 20px", fontSize: "15px" }
  }

  $: config = sizes[size]
</script>

<div class="loading-state" style="padding: {config.padding}">
  <div
    class="spinner"
    style="width: {config.spinner}px; height: {config.spinner}px">
  </div>
  <p style="font-size: {config.fontSize}">{message}</p>
</div>

<style>
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .spinner {
    border: 3px solid var(--nenspace-border, rgba(255, 255, 255, 0.2));
    border-top-color: var(--accent-primary, #e88b8b);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  p {
    font-size: 14px;
    color: var(--nenspace-text-secondary, #e5e7eb);
    margin: 0;
  }
</style>

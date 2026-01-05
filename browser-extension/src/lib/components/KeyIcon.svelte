<script lang="ts">
  export let key: string

  const keySymbols: Record<string, string> = {
    Meta: "⌘",
    Control: "⌃",
    Alt: "⌥",
    Shift: "⇧",
    Enter: "↵",
    Escape: "Esc",
    Backspace: "⌫",
    Delete: "⌦",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Tab: "⇥",
    Space: "␣"
  }

  $: displayKey = keySymbols[key] || key.toUpperCase()
</script>

<kbd class="key-icon">
  {displayKey}
</kbd>

<style>
  .key-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    padding: 4px 8px;
    background: var(--nenspace-input-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--nenspace-border, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    color: var(--nenspace-text-primary, #ffffff);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", monospace;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
</style>

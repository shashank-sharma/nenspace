<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import KeyIcon from "./KeyIcon.svelte"
  import IconCheck from "./icons/IconCheck.svelte"
  import IconClose from "./icons/IconClose.svelte"

  export let shortcutId: string
  export let currentKeys: string[] | null = null

  const dispatch = createEventDispatcher<{
    change: { shortcutId: string; keys: string[] | null }
  }>()

  let isRecording = false
  let recordedKeys: string[] = []
  let pressedKeys = new Set<string>()

  function startRecording() {
    isRecording = true
    recordedKeys = []
    pressedKeys.clear()
  }

  function stopRecording() {
    isRecording = false
    pressedKeys.clear()
  }

  function saveShortcut() {
    if (recordedKeys.length > 0) {
      dispatch("change", { shortcutId, keys: recordedKeys })
    }
    stopRecording()
  }

  function cancelRecording() {
    stopRecording()
  }

  function clearShortcut() {
    dispatch("change", { shortcutId, keys: null })
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!isRecording) return

    event.preventDefault()
    event.stopPropagation()

    const key = event.key

    // Skip if already pressed (holding down key)
    if (pressedKeys.has(key)) return

    pressedKeys.add(key)

    // Build the keys array in order: modifiers first, then regular key
    const newKeys: string[] = []

    if (event.metaKey && !newKeys.includes("Meta")) newKeys.push("Meta")
    if (event.ctrlKey && !newKeys.includes("Control")) newKeys.push("Control")
    if (event.altKey && !newKeys.includes("Alt")) newKeys.push("Alt")
    if (event.shiftKey && !newKeys.includes("Shift")) newKeys.push("Shift")

    // Add the actual key if it's not a modifier
    if (!["Meta", "Control", "Alt", "Shift"].includes(key)) {
      newKeys.push(key)
    }

    recordedKeys = newKeys
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (!isRecording) return

    event.preventDefault()
    pressedKeys.delete(event.key)
  }
</script>

<svelte:window on:keydown={handleKeyDown} on:keyup={handleKeyUp} />

<div class="shortcut-recorder">
  {#if !isRecording}
    <div class="shortcut-display">
      {#if currentKeys && currentKeys.length > 0}
        <div class="keys-display">
          {#each currentKeys as key}
            <KeyIcon {key} />
          {/each}
        </div>
      {:else}
        <span class="no-shortcut">No shortcut</span>
      {/if}
    </div>

    <div class="actions">
      <button class="btn-record" on:click={startRecording}>
        {currentKeys ? "Change" : "Record"}
      </button>
      {#if currentKeys}
        <button
          class="btn-clear"
          on:click={clearShortcut}
          title="Clear shortcut">
          <IconClose size={16} />
        </button>
      {/if}
    </div>
  {:else}
    <div class="recording-state">
      <div class="recording-label">
        <span class="recording-dot"></span>
        Recording... Press keys
      </div>

      <div class="keys-preview">
        {#if recordedKeys.length > 0}
          {#each recordedKeys as key}
            <KeyIcon {key} />
          {/each}
        {:else}
          <span class="waiting">Waiting for input...</span>
        {/if}
      </div>

      <div class="recording-actions">
        <button
          class="btn-save"
          on:click={saveShortcut}
          disabled={recordedKeys.length === 0}>
          <IconCheck size={16} />
          Save
        </button>
        <button class="btn-cancel" on:click={cancelRecording}>
          <IconClose size={16} />
          Cancel
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .shortcut-recorder {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--nenspace-input-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--nenspace-border, rgba(255, 255, 255, 0.1));
    border-radius: var(--nenspace-radius, 10px);
  }

  .shortcut-display {
    flex: 1;
    min-height: 32px;
    display: flex;
    align-items: center;
  }

  .keys-display {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .no-shortcut {
    color: var(--nenspace-text-muted, #888);
    font-size: 14px;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .btn-record,
  .btn-clear {
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn-record {
    background: var(--nenspace-accent-primary, #e88b8b);
    color: white;
  }

  .btn-record:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .btn-clear {
    background: transparent;
    border: 1px solid var(--nenspace-border, rgba(255, 255, 255, 0.1));
    color: var(--nenspace-text-secondary, #e5e7eb);
    padding: 6px 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-clear:hover {
    background: var(--nenspace-hover-bg, rgba(255, 255, 255, 0.1));
  }

  .recording-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .recording-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--nenspace-accent-tertiary, #d4a35a);
    font-weight: 500;
  }

  .recording-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--nenspace-accent-tertiary, #d4a35a);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }

  .keys-preview {
    display: flex;
    gap: 6px;
    min-height: 32px;
    align-items: center;
    padding: 8px;
    background: var(--nenspace-card-background, #2a2d31);
    border-radius: 6px;
  }

  .waiting {
    color: var(--nenspace-text-muted, #888);
    font-size: 13px;
    font-style: italic;
  }

  .recording-actions {
    display: flex;
    gap: 8px;
  }

  .btn-save,
  .btn-cancel {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-save {
    background: var(--nenspace-accent-secondary, #b4c96c);
    color: #1e2124;
  }

  .btn-save:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .btn-save:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid var(--nenspace-border, rgba(255, 255, 255, 0.1));
    color: var(--nenspace-text-secondary, #e5e7eb);
  }

  .btn-cancel:hover {
    background: var(--nenspace-hover-bg, rgba(255, 255, 255, 0.1));
  }
</style>

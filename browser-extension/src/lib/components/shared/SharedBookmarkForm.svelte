<script lang="ts">
  import { onMount } from "svelte"
  import IconBookmark from "../icons/IconBookmark.svelte"
  import IconClose from "../icons/IconClose.svelte"
  import IconCheck from "../icons/IconCheck.svelte"
  import { createLogger } from "../../utils/logger.util"

  const logger = createLogger("[SharedBookmarkForm]")

  export let onSave: (data: {
    url: string
    title: string
    tags: string
    notes: string
  }) => Promise<void>
  export let onCancel: () => void
  export let initialData:
    | { url?: string; title?: string; tags?: string; notes?: string }
    | undefined = undefined
  export let compact = false

  let url = initialData?.url || ""
  let title = initialData?.title || ""
  let tags = initialData?.tags || ""
  let notes = initialData?.notes || ""
  let isSaving = false
  let saveMessage = ""
  let isError = false

  onMount(async () => {
    // Get current tab info if no initial data provided
    if (!initialData && chrome?.tabs) {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true
        })
        if (tab) {
          url = tab.url || ""
          title = tab.title || ""
        }
      } catch (error) {
        logger.error("Failed to get current tab", error)
      }
    }
  })

  async function handleSubmit() {
    if (!url.trim()) {
      showMessage("URL is required", true)
      return
    }

    if (!title.trim()) {
      showMessage("Title is required", true)
      return
    }

    isSaving = true
    isError = false

    try {
      await onSave({ url, title, tags, notes })
      showMessage("Bookmark saved successfully!", false)

      // Close after success
      setTimeout(() => {
        onCancel()
      }, 1500)
    } catch (error) {
      logger.error("Failed to save bookmark", error)
      showMessage("Failed to save bookmark. Please try again.", true)
    } finally {
      isSaving = false
    }
  }

  function showMessage(message: string, error: boolean) {
    saveMessage = message
    isError = error
    setTimeout(() => {
      saveMessage = ""
      isError = false
    }, 3000)
  }
</script>

<div class="shared-bookmark-form" class:compact>
  <div class="header">
    <div class="header-icon">
      <IconBookmark size={24} color="var(--nenspace-accent-primary)" />
    </div>
    <div>
      <h2>Add Bookmark</h2>
      <p class="subtitle">Save this page to your bookmarks</p>
    </div>
  </div>

  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-group">
      <label for="url">
        URL
        <span class="required">*</span>
      </label>
      <input
        id="url"
        type="url"
        bind:value={url}
        placeholder="https://example.com"
        required
        disabled={isSaving} />
    </div>

    <div class="form-group">
      <label for="title">
        Title
        <span class="required">*</span>
      </label>
      <input
        id="title"
        type="text"
        bind:value={title}
        placeholder="Page title"
        required
        disabled={isSaving} />
    </div>

    <div class="form-group">
      <label for="tags">
        Tags
        <span class="optional">(optional)</span>
      </label>
      <input
        id="tags"
        type="text"
        bind:value={tags}
        placeholder="development, article, tutorial"
        disabled={isSaving} />
      <small class="hint">Comma-separated tags</small>
    </div>

    <div class="form-group">
      <label for="notes">
        Notes
        <span class="optional">(optional)</span>
      </label>
      <textarea
        id="notes"
        bind:value={notes}
        placeholder="Add notes about this bookmark..."
        rows="3"
        disabled={isSaving} />
    </div>

    {#if saveMessage}
      <div class="message" class:error={isError} class:success={!isError}>
        {saveMessage}
      </div>
    {/if}

    <div class="form-actions">
      <button
        type="button"
        class="btn-secondary"
        on:click={onCancel}
        disabled={isSaving}>
        <IconClose size={16} />
        Cancel
      </button>
      <button type="submit" class="btn-primary" disabled={isSaving}>
        {#if isSaving}
          <span class="spinner-small"></span>
          Saving...
        {:else}
          <IconCheck size={16} />
          Save Bookmark
        {/if}
      </button>
    </div>
  </form>
</div>

<style>
  .shared-bookmark-form {
    min-height: 400px;
  }

  .shared-bookmark-form.compact {
    min-height: 300px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
  }

  .header-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--nenspace-input-bg, rgba(255, 255, 255, 0.05));
    border-radius: var(--nenspace-radius, 10px);
    border: 1px solid var(--nenspace-border, rgba(255, 255, 255, 0.1));
  }

  .header h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 4px 0;
    color: var(--nenspace-text-primary, #ffffff);
  }

  .subtitle {
    font-size: 14px;
    color: var(--nenspace-text-secondary, #e5e7eb);
    margin: 0;
  }

  .form-group {
    margin-bottom: 20px;
  }

  label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--nenspace-text-primary, #ffffff);
    margin-bottom: 8px;
  }

  .required {
    color: var(--accent-primary, #e88b8b);
  }

  .optional {
    font-weight: 400;
    color: var(--nenspace-text-muted, #888);
    font-size: 13px;
  }

  input,
  textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--nenspace-border, rgba(255, 255, 255, 0.1));
    background: var(--nenspace-input-bg, rgba(255, 255, 255, 0.05));
    color: var(--nenspace-text-primary, #ffffff);
    font-size: 14px;
    border-radius: 8px;
    transition: all 0.2s;
    font-family: inherit;
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--nenspace-text-muted, #888);
  }

  input:focus,
  textarea:focus {
    outline: none;
    border-color: var(--accent-primary, #e88b8b);
    box-shadow: 0 0 0 3px rgba(232, 139, 139, 0.15);
  }

  input:disabled,
  textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  textarea {
    resize: vertical;
    min-height: 80px;
  }

  .hint {
    display: block;
    font-size: 12px;
    color: var(--nenspace-text-muted, #888);
    margin-top: 6px;
  }

  .message {
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 14px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .message.success {
    background: rgba(180, 201, 108, 0.15);
    color: var(--nenspace-accent-secondary, #b4c96c);
    border: 1px solid rgba(180, 201, 108, 0.3);
  }

  .message.error {
    background: rgba(232, 139, 139, 0.15);
    color: var(--accent-primary, #e88b8b);
    border: 1px solid rgba(232, 139, 139, 0.3);
  }

  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .btn-primary,
  .btn-secondary {
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-primary {
    background: var(--accent-primary, #e88b8b);
    color: var(--nenspace-background, #1e2124);
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(232, 139, 139, 0.3);
  }

  .btn-primary:hover:not(:disabled) {
    box-shadow: 0 6px 20px rgba(232, 139, 139, 0.4);
    transform: translateY(-1px);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .btn-secondary {
    background: var(--nenspace-input-bg, rgba(255, 255, 255, 0.05));
    color: var(--nenspace-text-primary, #ffffff);
    border: 1px solid var(--nenspace-border, rgba(255, 255, 255, 0.1));
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--nenspace-hover-bg, rgba(255, 255, 255, 0.1));
    border-color: var(--accent-primary, #e88b8b);
  }

  .spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(30, 33, 36, 0.3);
    border-top-color: var(--nenspace-background, #1e2124);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .compact .header h2 {
    font-size: 18px;
  }

  .compact .form-group {
    margin-bottom: 16px;
  }
</style>

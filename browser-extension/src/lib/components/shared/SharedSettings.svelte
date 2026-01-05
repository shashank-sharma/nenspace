<script lang="ts">
  import { onMount } from "svelte"
  import {
    authStorage,
    settingsStorage
  } from "../../services/plasmo-storage.service"
  import { shortcutsStore } from "../../stores/shortcuts.store"
  import { THEMES } from "../../config/constants"
  import type { StoredAuth } from "../../types/index"
  import ShortcutRecorder from "../ShortcutRecorder.svelte"
  import KeyIcon from "../KeyIcon.svelte"
  import { createLogger } from "../../utils/logger.util"

  const logger = createLogger("[SharedSettings]")

  export let onClose: (() => void) | undefined = undefined
  export let compact = false

  let authData: StoredAuth | null = null
  let currentTheme: string = THEMES.MODERN_DARK
  let isSaving = false
  let saveMessage = ""

  onMount(async () => {
    const authResult = await authStorage.get()
    authData = authResult.success ? authResult.data : null
    const themeResult = await settingsStorage.getTheme()
    currentTheme = themeResult.success ? themeResult.data : THEMES.MODERN_DARK

    // Initialize shortcuts store
    await shortcutsStore.init()
  })

  async function handleThemeChange(newTheme: string) {
    currentTheme = newTheme
    isSaving = true

    try {
      await settingsStorage.saveTheme(newTheme)
      showMessage("Theme updated successfully!")

      // Reload page to apply theme
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (error) {
      logger.error("Failed to save theme", error)
      showMessage("Failed to update theme")
    } finally {
      isSaving = false
    }
  }

  async function handleShortcutChange(
    event: CustomEvent<{ shortcutId: string; keys: string[] | null }>
  ) {
    const { shortcutId, keys } = event.detail

    try {
      if (keys === null) {
        await shortcutsStore.resetShortcut(shortcutId)
      } else {
        await shortcutsStore.updateShortcut(shortcutId, keys)
      }
      showMessage("Shortcut updated!")
    } catch (error) {
      logger.error("Failed to update shortcut", error)
      showMessage("Failed to update shortcut")
    }
  }

  function showMessage(message: string) {
    saveMessage = message
    setTimeout(() => {
      saveMessage = ""
    }, 3000)
  }
</script>

<div class="shared-settings" class:compact>
  <div class="header">
    <h2>Settings</h2>
    <p class="subtitle">Customize your extension preferences</p>
  </div>

  <div class="settings-sections">
    <!-- Account Section -->
    <section class="settings-section">
      <h3 class="section-title">Account</h3>
      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Email</div>
          <p class="setting-value">{authData?.email || "Not available"}</p>
        </div>
      </div>

      {#if authData?.email}
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-label">Name</div>
            <p class="setting-value">{authData.email.split('@')[0]}</p>
          </div>
        </div>
      {/if}

      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Backend URL</div>
          <p class="setting-value backend-url">
            {authData?.backendUrl || "Not available"}
          </p>
        </div>
      </div>
    </section>

    <!-- Appearance Section -->
    <section class="settings-section">
      <h3 class="section-title">Appearance</h3>
      <div class="setting-item">
        <div class="setting-info">
          <div class="setting-label">Theme</div>
          <p class="setting-description">
            Choose how the extension looks on your device
          </p>
        </div>
        <div class="theme-options">
          <button
            class="theme-option"
            class:active={currentTheme === THEMES.MODERN_DARK}
            on:click={() => handleThemeChange(THEMES.MODERN_DARK)}
            disabled={isSaving}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
            Modern Dark
          </button>

          <button
            class="theme-option"
            class:active={currentTheme === THEMES.LIGHT}
            on:click={() => handleThemeChange(THEMES.LIGHT)}
            disabled={isSaving}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            Light
          </button>

          <button
            class="theme-option"
            class:active={currentTheme === THEMES.DARK}
            on:click={() => handleThemeChange(THEMES.DARK)}
            disabled={isSaving}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            Dark
          </button>
        </div>
      </div>
    </section>

    <!-- Keyboard Shortcuts Section -->
    <section class="settings-section">
      <h3 class="section-title">Keyboard Shortcuts</h3>
      <p class="section-description">
        Customize keyboard shortcuts for quick access. Only Command Palette has
        a default shortcut.
      </p>

      <div class="shortcuts-list">
        {#each $shortcutsStore as shortcut (shortcut.id)}
          <div class="shortcut-config-item">
            <div class="shortcut-info">
              <div class="shortcut-label">{shortcut.label}</div>
              <div class="shortcut-description">{shortcut.description}</div>
            </div>

            <ShortcutRecorder
              shortcutId={shortcut.id}
              currentKeys={shortcut.userKeys || shortcut.defaultKeys}
              on:change={handleShortcutChange} />
          </div>
        {/each}
      </div>
    </section>
  </div>

  {#if saveMessage}
    <div class="save-message">{saveMessage}</div>
  {/if}
</div>

<style>
  .shared-settings {
    min-height: 400px;
  }

  .shared-settings.compact {
    min-height: 300px;
  }

  .header {
    margin-bottom: 28px;
  }

  .header h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 6px 0;
    color: var(--nenspace-text-primary, #ffffff);
  }

  .subtitle {
    font-size: 14px;
    color: var(--nenspace-text-secondary, #e5e7eb);
    margin: 0;
  }

  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .settings-section {
    border-bottom: 1px solid var(--nenspace-divider, rgba(255, 255, 255, 0.08));
    padding-bottom: 24px;
  }

  .settings-section:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 6px 0;
    color: var(--nenspace-text-primary, #ffffff);
  }

  .section-description {
    font-size: 13px;
    color: var(--nenspace-text-muted, #888);
    margin: 0 0 16px 0;
    line-height: 1.5;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 12px 0;
  }

  .setting-info {
    flex: 1;
  }

  .setting-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--nenspace-text-primary, #ffffff);
    margin-bottom: 4px;
  }

  .setting-value {
    font-size: 14px;
    color: var(--nenspace-text-secondary, #e5e7eb);
    margin: 0;
  }

  .backend-url {
    word-break: break-all;
    font-family: "SF Mono", "Monaco", "Inconsolata", monospace;
    font-size: 12px;
  }

  .setting-description {
    font-size: 13px;
    color: var(--nenspace-text-secondary, #e5e7eb);
    margin: 4px 0 12px 0;
  }

  .theme-options {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
  }

  .theme-option {
    flex: 1;
    min-width: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 14px 12px;
    border: 2px solid var(--nenspace-border, rgba(255, 255, 255, 0.1));
    background: var(--nenspace-input-bg, rgba(255, 255, 255, 0.05));
    color: var(--nenspace-text-primary, #ffffff);
    font-size: 13px;
    font-weight: 500;
    border-radius: var(--nenspace-radius, 10px);
    cursor: pointer;
    transition: all 0.2s;
  }

  .theme-option:hover:not(:disabled) {
    background: var(--nenspace-hover-bg, rgba(255, 255, 255, 0.1));
    border-color: var(--nenspace-accent-primary, #e88b8b);
    transform: translateY(-1px);
  }

  .theme-option.active {
    border-color: var(--nenspace-accent-primary, #e88b8b);
    background: rgba(232, 139, 139, 0.15);
    color: var(--nenspace-accent-primary, #e88b8b);
  }

  .theme-option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .shortcut-config-item {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--nenspace-input-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--nenspace-border, rgba(255, 255, 255, 0.1));
    border-radius: var(--nenspace-radius, 10px);
  }

  .shortcut-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .shortcut-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--nenspace-text-primary, #ffffff);
  }

  .shortcut-description {
    font-size: 12px;
    color: var(--nenspace-text-muted, #888);
  }

  .save-message {
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    background: var(--nenspace-accent-secondary, #b4c96c);
    color: var(--nenspace-background, #1e2124);
    font-size: 14px;
    font-weight: 600;
    border-radius: 8px;
    box-shadow: var(--shadow-elevated, 0 8px 24px rgba(0, 0, 0, 0.4));
    animation: slideIn 0.3s ease-out;
    z-index: 10000;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .compact .header h2 {
    font-size: 18px;
  }

  .compact .settings-sections {
    gap: 20px;
  }
</style>

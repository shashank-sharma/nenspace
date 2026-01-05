<!--
  Activity Settings Component
  Allows users to configure browsing activity tracking settings
-->

<script lang="ts">
  import { onMount } from "svelte"
  import { ActivityService } from "../services/activity.service"
  import type { ActivityStatus } from "../services/activity.service"
  import type { ActivitySettings } from "../../background/types"
  import {
    Settings,
    Activity,
    Shield,
    Clock,
    Trash2,
    Eye,
    EyeOff,
    Upload
  } from "lucide-svelte"
  import { devTokenStorage } from "../services/plasmo-storage.service"
  import { createLogger } from "../utils/logger.util"

  const logger = createLogger("[ActivitySettings]")

  let status: ActivityStatus | null = null
  let loading = true
  let saving = false
  let error: string | null = null
  let success: string | null = null
  let hasDevToken = false

  // Form state
  let settings: ActivitySettings = ActivityService.getDefaultSettings()
  let domainBlacklistText = ""

  onMount(async () => {
    try {
      status = await ActivityService.getStatus()
      settings = { ...status.settings }
      domainBlacklistText = settings.domainBlacklist.join("\n")

      // Check if dev token is available
      hasDevToken = await checkDevToken()

      // Listen for storage changes to refresh dev token status
      if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName === "local" && changes.nenspace_dev_token) {
            checkDevToken().then((tokenExists) => {
              hasDevToken = tokenExists
            })
          }
        })
      }

      // Also listen for localStorage changes (for cross-browser compatibility)
      if (typeof window !== "undefined") {
        window.addEventListener("storage", (e) => {
          if (e.key === "nenspace_dev_token") {
            checkDevToken().then((tokenExists) => {
              hasDevToken = tokenExists
            })
          }
        })
      }
    } catch (err) {
      error =
        "Failed to load activity settings. Please ensure the extension is active."
      logger.error("Failed to load activity settings", err)

      settings = ActivityService.getDefaultSettings()
      domainBlacklistText = settings.domainBlacklist.join("\n")
    } finally {
      loading = false
    }
  })

  async function checkDevToken(): Promise<boolean> {
    try {
      const tokenResult = await devTokenStorage.get()
      return tokenResult.success && !!tokenResult.data
    } catch {
      return false
    }
  }

  // Export function to refresh dev token status (can be called from parent)
  export async function refreshDevTokenStatus(): Promise<void> {
    hasDevToken = await checkDevToken()
  }

  async function saveSettings() {
    saving = true
    error = null
    success = null

    try {
      const domainBlacklist = domainBlacklistText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      const newSettings: Partial<ActivitySettings> = {
        ...settings,
        domainBlacklist
      }

      const validationErrors = ActivityService.validateSettings(newSettings)
      if (validationErrors.length > 0) {
        error = validationErrors.join(", ")
        return
      }

      await ActivityService.updateSettings(newSettings)
      success = "Settings saved successfully"

      status = await ActivityService.getStatus()
    } catch (err) {
      error = "Failed to save settings"
      logger.error("Failed to save settings", err)
    } finally {
      saving = false
    }
  }

  async function toggleTracking() {
    try {
      if (settings.enabled) {
        await ActivityService.stopTracking()
      } else {
        await ActivityService.startTracking()
      }
      await saveSettings()
    } catch (err) {
      error = "Failed to toggle tracking"
      logger.error("Failed to toggle tracking", err)
    }
  }

  async function toggleSync() {
    if (!hasDevToken) {
      error = "Dev token required to enable sync"
      return
    }

    try {
      settings.syncEnabled = !settings.syncEnabled
      await saveSettings()
    } catch (err) {
      error = "Failed to toggle sync"
      logger.error("Failed to toggle sync", err)
    }
  }

  function clearSuccess() {
    success = null
  }

  function clearError() {
    error = null
  }
</script>

<div class="activity-settings">
  <div class="header">
    <Activity class="icon" />
    <h2>Activity Tracking</h2>
  </div>

  {#if loading}
    <div class="loading">Loading settings...</div>
  {:else}
    <div class="settings-form">
      <!-- Enable/Disable Tracking -->
      <div class="setting-group">
        <div class="setting-header">
          <div class="setting-title">
            <Settings class="icon" />
            <span>Tracking Control</span>
          </div>
          <button
            class="toggle-button"
            class:enabled={settings.enabled}
            on:click={toggleTracking}
            disabled={saving}>
            {#if settings.enabled}
              <Eye class="icon" />
              <span>Enabled</span>
            {:else}
              <EyeOff class="icon" />
              <span>Disabled</span>
            {/if}
          </button>
        </div>
        <p class="setting-description">
          Track your browsing activity to analyze productivity and sync history
          across devices.
        </p>
      </div>

      <!-- Activity Sync -->
      <div class="setting-group">
        <div class="setting-header">
          <div class="setting-title">
            <Upload class="icon" />
            <span>Activity Sync</span>
          </div>
          <button
            class="toggle-button"
            class:enabled={settings.syncEnabled}
            class:disabled={!hasDevToken}
            on:click={toggleSync}
            disabled={saving || !hasDevToken}>
            {#if settings.syncEnabled}
              <Upload class="icon" />
              <span>Enabled</span>
            {:else}
              <Upload class="icon" />
              <span>Disabled</span>
            {/if}
          </button>
        </div>
        <p class="setting-description">
          {#if hasDevToken}
            Sync your browsing activity to the server for analytics and backup.
          {:else}
            <span class="warning-text">Dev token required to enable sync</span>
          {/if}
        </p>
      </div>

      <!-- Incognito Mode -->
      <div class="setting-group">
        <div class="setting-title">
          <Shield class="icon" />
          <span>Incognito Mode</span>
        </div>
        <select bind:value={settings.incognitoMode} disabled={saving}>
          <option value="track">Track normally</option>
          <option value="mark">Mark as incognito</option>
          <option value="skip">Skip tracking</option>
        </select>
        <p class="setting-description">
          How to handle browsing in incognito/private mode.
        </p>
      </div>

      <!-- Heartbeat Interval -->
      <div class="setting-group">
        <div class="setting-title">
          <Clock class="icon" />
          <span>Update Frequency</span>
        </div>
        <select bind:value={settings.heartbeatInterval} disabled={saving}>
          <option value={15}>Every 15 seconds</option>
          <option value={30}>Every 30 seconds</option>
          <option value={60}>Every 1 minute</option>
          <option value={120}>Every 2 minutes</option>
        </select>
        <p class="setting-description">
          How often to update activity data. More frequent updates provide
          better accuracy but use more resources.
        </p>
      </div>

      <!-- Sync Interval -->
      <div class="setting-group">
        <div class="setting-title">
          <Upload class="icon" />
          <span>Sync Frequency</span>
        </div>
        <select bind:value={settings.syncInterval} disabled={saving}>
          <option value={10}>Every 10 seconds</option>
          <option value={30}>Every 30 seconds</option>
          <option value={60}>Every 1 minute</option>
          <option value={300}>Every 5 minutes</option>
          <option value={600}>Every 10 minutes</option>
          <option value={1800}>Every 30 minutes</option>
        </select>
        <p class="setting-description">
          How often to sync data to the server (when sync is enabled).
        </p>
      </div>

      <!-- Domain Blacklist -->
      <div class="setting-group">
        <div class="setting-title">
          <Trash2 class="icon" />
          <span>Domain Blacklist</span>
        </div>
        <textarea
          bind:value={domainBlacklistText}
          placeholder="Enter domains to exclude from tracking, one per line:&#10;banking.example.com&#10;*.private.com"
          disabled={saving}
          rows="4"></textarea>
        <p class="setting-description">
          Domains to exclude from activity tracking. Use * for wildcards (e.g.,
          *.banking.com).
        </p>
      </div>

      <!-- Auto Cleanup -->
      <div class="setting-group">
        <div class="setting-title">
          <Trash2 class="icon" />
          <span>Auto Cleanup</span>
        </div>
        <input
          type="number"
          bind:value={settings.autoCleanupDays}
          min="1"
          max="365"
          disabled={saving} />
        <span class="input-suffix">days</span>
        <p class="setting-description">
          Automatically delete activity data older than this many days.
        </p>
      </div>

      <!-- Status Display -->
      {#if status}
        <div class="status-section">
          <h3>Current Status</h3>
          <div class="status-grid">
            <div class="status-item">
              <span class="label">Current Activity:</span>
              <span class="value">
                {status.currentActivity ? status.currentActivity.title : "None"}
              </span>
            </div>
            <div class="status-item">
              <span class="label">Session:</span>
              <span class="value">
                {status.sessionInfo ? "Active" : "None"}
              </span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Messages -->
      {#if error}
        <div
          class="message error"
          on:click={clearError}
          on:keydown={(e) => e.key === "Enter" && clearError()}
          role="button"
          tabindex="0">
          {error}
        </div>
      {/if}

      {#if success}
        <div
          class="message success"
          on:click={clearSuccess}
          on:keydown={(e) => e.key === "Enter" && clearSuccess()}
          role="button"
          tabindex="0">
          {success}
        </div>
      {/if}

      <!-- Save Button -->
      <button class="save-button" on:click={saveSettings} disabled={saving}>
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  {/if}
</div>

<style>
  .activity-settings {
    padding: 1rem;
    max-width: 500px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--nenspace-border);
  }

  .header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--nenspace-foreground);
  }

  .header .icon {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--nenspace-primary);
  }

  .setting-title .icon {
    width: 1rem;
    height: 1rem;
    color: var(--nenspace-muted-foreground);
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--nenspace-muted-foreground);
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .setting-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .setting-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    color: var(--nenspace-foreground);
  }

  .setting-description {
    font-size: 0.875rem;
    color: var(--nenspace-muted-foreground);
    margin: 0;
  }

  .toggle-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--nenspace-border);
    border-radius: 0.375rem;
    background: var(--nenspace-background);
    color: var(--nenspace-muted-foreground);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-button:hover:not(.disabled) {
    background: var(--nenspace-accent);
  }

  .toggle-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .warning-text {
    color: var(--nenspace-destructive);
    font-weight: 500;
  }

  .toggle-button.enabled {
    background: var(--nenspace-primary);
    color: var(--nenspace-primary-foreground);
    border-color: var(--nenspace-primary);
  }

  .toggle-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  select,
  input,
  textarea {
    padding: 0.5rem;
    border: 1px solid var(--nenspace-border);
    border-radius: 0.375rem;
    background: var(--nenspace-background);
    color: var(--nenspace-foreground);
    font-size: 0.875rem;
  }

  select:focus,
  input:focus,
  textarea:focus {
    outline: none;
    border-color: var(--nenspace-primary);
    box-shadow: 0 0 0 3px var(--nenspace-primary);
    opacity: 0.8;
  }

  select:disabled,
  input:disabled,
  textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  textarea {
    resize: vertical;
    font-family: monospace;
    font-size: 0.75rem;
  }

  .input-suffix {
    margin-left: 0.5rem;
    color: var(--nenspace-muted-foreground);
    font-size: 0.875rem;
  }

  .status-section {
    padding: 1rem;
    background: var(--nenspace-card);
    border-radius: 0.5rem;
    border: 1px solid var(--nenspace-border);
  }

  .status-section h3 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--nenspace-foreground);
  }

  .status-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-item .label {
    font-weight: 500;
    color: var(--nenspace-muted-foreground);
  }

  .status-item .value {
    font-family: monospace;
    font-size: 0.875rem;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--nenspace-foreground);
  }

  .message {
    padding: 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .message.error {
    background: var(--nenspace-destructive);
    color: var(--nenspace-destructive-foreground);
  }

  .message.success {
    background: var(--success);
    color: var(--success-foreground);
  }

  .save-button {
    padding: 0.75rem 1.5rem;
    background: var(--nenspace-primary);
    color: var(--nenspace-primary-foreground);
    border: none;
    border-radius: 0.375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .save-button:hover:not(:disabled) {
    background: var(--nenspace-primary);
    opacity: 0.9;
  }

  .save-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

<!--
  Minimal History Sync Settings Component
  Clean, compact UI for browser history synchronization
-->

<script lang="ts">
  import { onMount } from "svelte"
  import {
    History,
    Database,
    RefreshCw,
    CheckCircle,
    AlertCircle
  } from "lucide-svelte"
  import {
    HistorySyncService,
    type HistorySyncStatus
  } from "../services/history-sync.service"
  import { devTokenStorage } from "../services/plasmo-storage.service"

  let status: HistorySyncStatus | null = null
  let loading = true
  let syncing = false
  let error = ""
  let success = ""
  let hasDevToken = false
  let syncEnabled = false

  onMount(async () => {
    await refreshStatus()
    hasDevToken = await checkDevToken()
    syncEnabled = await getSyncEnabled()

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
  })

  async function checkDevToken(): Promise<boolean> {
    try {
      const tokenResult = await devTokenStorage.get()
      return tokenResult.success && !!tokenResult.data
    } catch {
      return false
    }
  }

  async function getSyncEnabled(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get([
        "nenspace_history_sync_enabled"
      ])
      return !!result["nenspace_history_sync_enabled"]
    } catch {
      return false
    }
  }

  async function setSyncEnabled(enabled: boolean): Promise<void> {
    try {
      await chrome.storage.local.set({ nenspace_history_sync_enabled: enabled })
      syncEnabled = enabled
    } catch (err) {
      console.error("Failed to save sync setting:", err)
    }
  }

  async function refreshStatus() {
    loading = true
    error = ""
    try {
      status = await HistorySyncService.getStatus()
    } catch (err) {
      error = "Failed to load history sync status"
      console.error("Failed to load status:", err)
    } finally {
      loading = false
    }
  }

  async function syncFullHistory() {
    if (syncing) return

    syncing = true
    error = ""
    success = ""

    try {
      await HistorySyncService.syncFullHistory()
      success = "History sync started successfully"
      await refreshStatus()
    } catch (err) {
      error = "Failed to start history sync"
      console.error("Sync error:", err)
    } finally {
      syncing = false
    }
  }

  function formatDate(date: Date | null): string {
    if (!date) return "Never"
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(date))
  }

  function formatNumber(num: number): string {
    return new Intl.NumberFormat("en-US").format(num)
  }

  // Export function to refresh dev token status (can be called from parent)
  export async function refreshDevTokenStatus(): Promise<void> {
    hasDevToken = await checkDevToken()
  }
</script>

<div class="history-sync-minimal">
  <div class="header">
    <History class="icon" />
    <h2>Browser History Sync</h2>
  </div>

  <!-- Compact Sync Toggle -->
  <div class="sync-toggle">
    <div class="toggle-content">
      <div class="toggle-info">
        <span class="toggle-label">History Sync</span>
        {#if hasDevToken}
          <span class="toggle-description"
            >Backup & analyze your browsing history</span>
        {:else}
          <span class="warning-text">Dev token required</span>
        {/if}
      </div>
      <button
        class="toggle-switch"
        class:enabled={syncEnabled}
        class:disabled={!hasDevToken}
        on:click={() => setSyncEnabled(!syncEnabled)}
        disabled={!hasDevToken}>
        <div class="switch-slider"></div>
      </button>
    </div>
  </div>

  <!-- Status Summary -->
  {#if loading}
    <div class="status-loading">Loading...</div>
  {:else if status}
    <div class="status-summary">
      <div class="status-item">
        <span class="status-label">Last Sync</span>
        <span class="status-value"
          >{formatDate(status.checkpoint.lastSyncTime)}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Synced</span>
        <span class="status-value"
          >{formatNumber(status.checkpoint.totalSynced)} items</span>
      </div>
      {#if status.checkpoint.failedBatches > 0}
        <div class="status-item error">
          <AlertCircle class="icon" />
          <span class="status-label">Failed</span>
          <span class="status-value"
            >{formatNumber(status.checkpoint.failedBatches)} batches</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Sync Progress -->
  {#if status?.state.syncInProgress}
    <div class="sync-progress">
      <div class="progress-bar">
        <div
          class="progress-fill"
          style="width: {status.state.totalBatches > 0
            ? (status.state.currentBatch / status.state.totalBatches) * 100
            : 0}%">
        </div>
      </div>
      <div class="progress-text">
        Syncing batch {status.state.currentBatch} of {status.state.totalBatches}
      </div>
    </div>
  {/if}

  <!-- Actions -->
  <div class="actions">
    <button
      class="action-button primary"
      on:click={syncFullHistory}
      disabled={syncing || !hasDevToken}>
      {#if syncing}
        <RefreshCw class="icon spinning" />
        <span>Syncing...</span>
      {:else}
        <Database class="icon" />
        <span>Sync History</span>
      {/if}
    </button>

    <button
      class="action-button secondary"
      on:click={refreshStatus}
      disabled={syncing}>
      <RefreshCw class="icon" />
    </button>
  </div>

  <!-- Messages -->
  {#if error}
    <div class="message error">
      <AlertCircle class="icon" />
      <span>{error}</span>
    </div>
  {/if}

  {#if success}
    <div class="message success">
      <CheckCircle class="icon" />
      <span>{success}</span>
    </div>
  {/if}
</div>

<style>
  .history-sync-minimal {
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .header .icon {
    width: 20px;
    height: 20px;
    color: var(--text-secondary);
  }

  .header h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .sync-toggle {
    margin-bottom: 1rem;
  }

  .toggle-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: var(--bg-primary);
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }

  .toggle-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .toggle-label {
    font-weight: 500;
    color: var(--text-primary);
  }

  .toggle-description {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .warning-text {
    font-size: 0.85rem;
    color: var(--error-color);
  }

  .toggle-switch {
    position: relative;
    width: 44px;
    height: 24px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toggle-switch.enabled {
    background: var(--primary-color);
    border-color: var(--primary-color);
  }

  .toggle-switch.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .switch-slider {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s ease;
  }

  .toggle-switch.enabled .switch-slider {
    transform: translateX(20px);
  }

  .status-loading {
    text-align: center;
    padding: 1rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .status-summary {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--bg-primary);
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .status-item.error {
    background: var(--error-bg);
    color: var(--error-color);
  }

  .status-item .icon {
    width: 16px;
    height: 16px;
  }

  .status-label {
    color: var(--text-secondary);
    min-width: 60px;
  }

  .status-value {
    color: var(--text-primary);
    font-weight: 500;
  }

  .sync-progress {
    margin-bottom: 1rem;
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .progress-fill {
    height: 100%;
    background: var(--primary-color);
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.85rem;
    color: var(--text-secondary);
    text-align: center;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .action-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-button.primary {
    flex: 1;
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }

  .action-button.primary:hover:not(:disabled) {
    background: var(--primary-hover);
  }

  .action-button.secondary {
    padding: 0.5rem;
    min-width: 40px;
  }

  .action-button:hover:not(:disabled) {
    background: var(--bg-secondary);
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-button .icon {
    width: 16px;
    height: 16px;
  }

  .action-button .icon.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .message.error {
    background: var(--error-bg);
    color: var(--error-color);
    border: 1px solid var(--error-border);
  }

  .message.success {
    background: var(--success-bg);
    color: var(--success-color);
    border: 1px solid var(--success-border);
  }

  .message .icon {
    width: 16px;
    height: 16px;
  }
</style>

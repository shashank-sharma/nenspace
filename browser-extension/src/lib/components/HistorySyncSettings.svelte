<script lang="ts">
  import { onMount } from 'svelte'
  import { History, Clock, Database, AlertCircle, CheckCircle, RefreshCw } from 'lucide-svelte'
  import { HistorySyncService, type HistorySyncStatus } from '../services/history-sync.service'
  import { devTokenStorage } from '../services/plasmo-storage.service'
  import { createLogger } from '../utils/logger.util'

  const logger = createLogger('[HistorySyncSettings]')

  let status: HistorySyncStatus | null = null
  let loading = true
  let syncing = false
  let error = ''
  let success = ''
  let hasDevToken = false
  let syncEnabled = false

  onMount(async () => {
    await refreshStatus()
    hasDevToken = await checkDevToken()
    syncEnabled = await getSyncEnabled()
    
    // Listen for storage changes to refresh dev token status
    if (chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.nenspace_dev_token) {
          checkDevToken().then(tokenExists => {
            hasDevToken = tokenExists
          })
        }
      })
    }
    
    // Also listen for localStorage changes (for cross-browser compatibility)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'nenspace_dev_token') {
          checkDevToken().then(tokenExists => {
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

  // Export function to refresh dev token status (can be called from parent)
  export async function refreshDevTokenStatus(): Promise<void> {
    hasDevToken = await checkDevToken()
  }

  async function getSyncEnabled(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(['nenspace_history_sync_enabled'])
      return !!result['nenspace_history_sync_enabled']
    } catch {
      return false
    }
  }

  async function setSyncEnabled(enabled: boolean): Promise<void> {
    try {
      await chrome.storage.local.set({ 'nenspace_history_sync_enabled': enabled })
      syncEnabled = enabled
    } catch (err) {
      logger.error('Failed to save sync setting', err)
    }
  }

  async function refreshStatus() {
    loading = true
    error = ''
    try {
      status = await HistorySyncService.getStatus()
    } catch (err) {
      error = 'Failed to load history sync status'
      logger.error('Failed to load status', err)
    } finally {
      loading = false
    }
  }

  async function syncFullHistory() {
    if (syncing) return
    if (!hasDevToken) {
      error = 'Dev token required to sync history'
      return
    }
    if (!syncEnabled) {
      error = 'History sync is disabled. Please enable it first.'
      return
    }
    
    syncing = true
    error = ''
    success = ''
    
    try {
      const result = await HistorySyncService.syncFullHistory({ maxDays: 90 })
      if (result) {
        success = 'Full history sync started successfully'
        await refreshStatus()
      } else {
        error = 'Failed to start full history sync'
      }
    } catch (err) {
      error = 'Failed to start full history sync'
      logger.error('Sync error', err)
    } finally {
      syncing = false
    }
  }

  async function syncIncrementalHistory() {
    if (syncing) return
    if (!hasDevToken) {
      error = 'Dev token required to sync history'
      return
    }
    if (!syncEnabled) {
      error = 'History sync is disabled. Please enable it first.'
      return
    }
    
    syncing = true
    error = ''
    success = ''
    
    try {
      const result = await HistorySyncService.syncIncrementalHistory()
      if (result) {
        success = 'Incremental history sync started successfully'
        await refreshStatus()
      } else {
        error = 'Failed to start incremental history sync'
      }
    } catch (err) {
      error = 'Failed to start incremental history sync'
      logger.error('Sync error', err)
    } finally {
      syncing = false
    }
  }

  function clearError() {
    error = ''
  }

  function clearSuccess() {
    success = ''
  }

  function formatDate(date: Date | null): string {
    if (!date) return 'Never'
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num)
  }
</script>

<div class="history-sync-settings">
  <div class="header">
    <History class="icon" />
    <h2>Browser History Sync</h2>
  </div>

  <!-- Compact Sync Toggle -->
  <div class="sync-toggle-compact">
    <div class="toggle-content">
      <div class="toggle-info">
        <span class="toggle-label">History Sync</span>
        {#if hasDevToken}
          <span class="toggle-description">Backup & analyze your browsing history</span>
        {:else}
          <span class="warning-text">Dev token required</span>
        {/if}
      </div>
      <button 
        class="toggle-switch" 
        class:enabled={syncEnabled}
        class:disabled={!hasDevToken}
        on:click={() => setSyncEnabled(!syncEnabled)}
        disabled={!hasDevToken}
      >
        <div class="switch-slider"></div>
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if status}
    <!-- Compact Status Display -->
    <div class="status-compact">
      <div class="status-row">
        <span class="status-label">Last Sync</span>
        <span class="status-value">{formatDate(status.checkpoint.lastSyncTime)}</span>
      </div>
      <div class="status-row">
        <span class="status-label">Synced</span>
        <span class="status-value">{formatNumber(status.checkpoint.totalSynced)} items</span>
      </div>
      {#if status.checkpoint.failedBatches > 0}
        <div class="status-row error">
          <span class="status-label">Failed</span>
          <span class="status-value">{formatNumber(status.checkpoint.failedBatches)} batches</span>
        </div>
      {/if}
    </div>

      <!-- Current Sync Progress -->
      {#if status.state.syncInProgress}
        <div class="status-card">
          <h3>Sync Progress</h3>
          <div class="progress-info">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                style="width: {status.state.totalBatches > 0 ? (status.state.currentBatch / status.state.totalBatches) * 100 : 0}%"
              ></div>
            </div>
            <div class="progress-text">
              Batch {status.state.currentBatch} of {status.state.totalBatches}
            </div>
            <div class="progress-details">
              <div class="detail-item">
                <span class="label">Processed:</span>
                <span class="value">{formatNumber(status.state.itemsProcessed)}</span>
              </div>
              <div class="detail-item">
                <span class="label">Failed:</span>
                <span class="value" class:error={status.state.failedItems > 0}>
                  {formatNumber(status.state.failedItems)}
                </span>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Sync Controls -->
      <div class="status-card">
        <h3>Sync Controls</h3>
        <div class="sync-controls">
          <button 
            class="sync-button full-sync" 
            on:click={syncFullHistory}
            disabled={syncing || status.state.syncInProgress}>
            <Database class="icon" />
            {syncing ? 'Syncing...' : 'Full History Sync'}
          </button>
          
          <button 
            class="sync-button incremental-sync" 
            on:click={syncIncrementalHistory}
            disabled={syncing || status.state.syncInProgress}>
            <RefreshCw class="icon" />
            {syncing ? 'Syncing...' : 'Incremental Sync'}
          </button>
          
          <button 
            class="refresh-button" 
            on:click={refreshStatus}
            disabled={loading}>
            <RefreshCw class="icon {loading ? 'spinning' : ''}" />
            Refresh Status
          </button>
        </div>
      </div>

      <!-- Sync Info -->
      <div class="status-card full-width">
        <h3>Sync Information</h3>
        <div class="info-grid">
          <div class="info-item">
            <Clock class="icon" />
            <div class="info-content">
              <h4>Automatic Sync</h4>
              <p>Incremental sync runs automatically every 6 hours to keep your history up to date.</p>
            </div>
          </div>
          <div class="info-item">
            <Database class="icon" />
            <div class="info-content">
              <h4>Full Sync</h4>
              <p>Syncs your entire browser history (last 90 days) to the cloud. This is a one-time operation.</p>
            </div>
          </div>
          <div class="info-item">
            <History class="icon" />
            <div class="info-content">
              <h4>Incremental Sync</h4>
              <p>Syncs only new history items since the last successful sync. Faster and more efficient.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Messages -->
    {#if error}
      <div class="message error" on:click={clearError} on:keydown={(e) => e.key === 'Enter' && clearError()} role="button" tabindex="0">
        <AlertCircle class="icon" />
        {error}
      </div>
    {/if}

    {#if success}
      <div class="message success" on:click={clearSuccess} on:keydown={(e) => e.key === 'Enter' && clearSuccess()} role="button" tabindex="0">
        <CheckCircle class="icon" />
        {success}
      </div>
    {/if}
  {/if}
</div>

<style>
  .history-sync-settings {
    padding: 1.5rem;
    background: var(--nenspace-background);
    border-radius: 0.75rem;
    border: 1px solid var(--nenspace-border);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .header .icon {
    width: 1.5rem;
    height: 1.5rem;
    color: var(--nenspace-primary);
  }

  .header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--nenspace-foreground);
  }

  .sync-toggle {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--nenspace-card);
    border: 1px solid var(--nenspace-border);
    border-radius: 0.5rem;
  }

  .toggle-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .toggle-label {
    font-weight: 500;
    color: var(--nenspace-foreground);
  }

  .toggle-button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--nenspace-border);
    border-radius: 0.375rem;
    background: var(--nenspace-background);
    color: var(--nenspace-foreground);
    font-size: 0.875rem;
    font-weight: 500;
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

  .toggle-button.enabled {
    background: var(--nenspace-primary);
    color: var(--nenspace-primary-foreground);
    border-color: var(--nenspace-primary);
  }

  .toggle-description {
    margin: 0;
    font-size: 0.875rem;
    color: var(--nenspace-muted-foreground);
  }

  .warning-text {
    color: var(--nenspace-destructive);
    font-weight: 500;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: var(--nenspace-muted-foreground);
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .status-card {
    background: var(--nenspace-card);
    border: 1px solid var(--nenspace-border);
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .status-card.full-width {
    grid-column: 1 / -1;
  }

  .status-card h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--nenspace-foreground);
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--nenspace-border);
  }

  .status-item:last-child {
    border-bottom: none;
  }

  .status-item .label {
    font-weight: 500;
    color: var(--nenspace-muted-foreground);
  }

  .status-item .value {
    font-weight: 600;
    color: var(--nenspace-foreground);
  }

  .status-item .value.success {
    color: var(--success);
  }

  .status-item .value.error {
    color: var(--nenspace-destructive);
  }

  .progress-info {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .progress-bar {
    width: 100%;
    height: 0.5rem;
    background: var(--nenspace-muted);
    border-radius: 0.25rem;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--nenspace-primary);
    transition: width 0.3s ease;
  }

  .progress-text {
    text-align: center;
    font-weight: 500;
    color: var(--nenspace-foreground);
  }

  .progress-details {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .detail-item .label {
    font-size: 0.875rem;
    color: var(--nenspace-muted-foreground);
  }

  .detail-item .value {
    font-weight: 600;
    color: var(--nenspace-foreground);
  }

  .detail-item .value.error {
    color: var(--nenspace-destructive);
  }

  .sync-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .sync-button, .refresh-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--nenspace-border);
    border-radius: 0.5rem;
    background: var(--nenspace-background);
    color: var(--nenspace-foreground);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .sync-button:hover:not(:disabled), .refresh-button:hover:not(:disabled) {
    background: var(--nenspace-accent);
    border-color: var(--nenspace-accent-foreground);
  }

  .sync-button:disabled, .refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sync-button.full-sync {
    background: var(--nenspace-primary);
    color: var(--nenspace-primary-foreground);
    border-color: var(--nenspace-primary);
  }

  .sync-button.full-sync:hover:not(:disabled) {
    background: var(--nenspace-primary);
    opacity: 0.9;
  }

  .sync-button .icon, .refresh-button .icon {
    width: 1rem;
    height: 1rem;
  }

  .refresh-button .icon.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .info-item {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--nenspace-muted);
    border-radius: 0.5rem;
  }

  .info-item .icon {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--nenspace-primary);
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .info-content h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--nenspace-foreground);
  }

  .info-content p {
    margin: 0;
    font-size: 0.875rem;
    color: var(--nenspace-muted-foreground);
    line-height: 1.4;
  }

  .message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s ease;
  }

  .message:hover {
    opacity: 0.8;
  }

  .message.error {
    background: var(--nenspace-destructive);
    color: var(--nenspace-destructive-foreground);
  }

  .message.success {
    background: var(--success);
    color: var(--success-foreground);
  }

  .message .icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
</style>


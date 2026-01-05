<!--
  Activity Test Component
  Simple test interface to verify activity tracking functionality
-->

<script lang="ts">
  import { onMount } from 'svelte'
  import { ActivityService } from '../services/activity.service'
  import type { ActivityStatus } from '../services/activity.service'
  import { Activity, Play, Square, RefreshCw, Settings } from 'lucide-svelte'

  let status: ActivityStatus | null = null
  let loading = true
  let error: string | null = null

  onMount(async () => {
    await refreshStatus()
  })

  async function refreshStatus() {
    loading = true
    error = null
    
    try {
      status = await ActivityService.getStatus()
    } catch (err) {
      error = 'Failed to load activity status'
      console.error('Failed to load activity status:', err)
    } finally {
      loading = false
    }
  }

  async function startTracking() {
    try {
      await ActivityService.startTracking()
      await refreshStatus()
    } catch (err) {
      error = 'Failed to start tracking'
      console.error('Failed to start tracking:', err)
    }
  }

  async function stopTracking() {
    try {
      await ActivityService.stopTracking()
      await refreshStatus()
    } catch (err) {
      error = 'Failed to stop tracking'
      console.error('Failed to stop tracking:', err)
    }
  }

  function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  function formatDate(dateString: string | Date): string {
    return new Date(dateString).toLocaleString()
  }
</script>

<div class="activity-test">
  <div class="header">
    <Activity class="icon" />
    <h2>Activity Tracking Test</h2>
      <button class="refresh-button" on:click={refreshStatus} disabled={loading}>
        <RefreshCw class="icon" class:spinning={loading} />
      </button>
  </div>

  {#if loading}
    <div class="loading">Loading activity status...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if status}
    <div class="status-content">
      <!-- Tracking Control -->
      <div class="control-section">
        <h3>Tracking Control</h3>
        <div class="control-buttons">
          <button 
            class="control-button start" 
            on:click={startTracking}
            disabled={status.settings.enabled}
          >
            <Play class="icon" />
            <span>Start Tracking</span>
          </button>
          <button 
            class="control-button stop" 
            on:click={stopTracking}
            disabled={!status.settings.enabled}
          >
            <Square class="icon" />
            <span>Stop Tracking</span>
          </button>
        </div>
        <div class="status-indicator" class:enabled={status.settings.enabled}>
          {status.settings.enabled ? 'Tracking Active' : 'Tracking Disabled'}
        </div>
      </div>

      <!-- Settings Summary -->
      <div class="settings-section">
        <h3>Current Settings</h3>
        <div class="settings-grid">
          <div class="setting-item">
            <span class="label">Incognito Mode:</span>
            <span class="value">{status.settings.incognitoMode}</span>
          </div>
          <div class="setting-item">
            <span class="label">Heartbeat Interval:</span>
            <span class="value">{status.settings.heartbeatInterval}s</span>
          </div>
          <div class="setting-item">
            <span class="label">Auto Cleanup:</span>
            <span class="value">{status.settings.autoCleanupDays} days</span>
          </div>
          <div class="setting-item">
            <span class="label">Blacklisted Domains:</span>
            <span class="value">{status.settings.domainBlacklist.length}</span>
          </div>
        </div>
      </div>

      <!-- Current Activity -->
      {#if status.currentActivity}
        <div class="activity-section">
          <h3>Current Activity</h3>
          <div class="activity-card">
            <div class="activity-header">
              <span class="activity-title">{status.currentActivity.title}</span>
              <span class="activity-status" class:active={status.currentActivity.is_active}>
                {status.currentActivity.is_active ? 'Active' : 'Background'}
              </span>
            </div>
            <div class="activity-details">
              <div class="detail-item">
                <span class="label">URL:</span>
                <span class="value url">{status.currentActivity.url}</span>
              </div>
              <div class="detail-item">
                <span class="label">Domain:</span>
                <span class="value">{status.currentActivity.domain || 'Unknown'}</span>
              </div>
              <div class="detail-item">
                <span class="label">Started:</span>
                <span class="value">{formatDate(status.currentActivity.start_time)}</span>
              </div>
              {#if status.currentActivity.duration}
                <div class="detail-item">
                  <span class="label">Duration:</span>
                  <span class="value">{formatDuration(status.currentActivity.duration)}</span>
                </div>
              {/if}
              <div class="detail-item">
                <span class="label">Audible:</span>
                <span class="value">{status.currentActivity.audible ? 'Yes' : 'No'}</span>
              </div>
              <div class="detail-item">
                <span class="label">Incognito:</span>
                <span class="value">{status.currentActivity.incognito ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        </div>
      {:else}
        <div class="no-activity">
          <p>No current activity being tracked</p>
        </div>
      {/if}

      <!-- Session Info -->
      {#if status.sessionInfo}
        <div class="session-section">
          <h3>Session Information</h3>
          <div class="session-card">
            <div class="session-details">
              <div class="detail-item">
                <span class="label">Session ID:</span>
                <span class="value session-id">{status.sessionInfo.id}</span>
              </div>
              <div class="detail-item">
                <span class="label">Started:</span>
                <span class="value">{formatDate(status.sessionInfo.startTime)}</span>
              </div>
              <div class="detail-item">
                <span class="label">Last Activity:</span>
                <span class="value">{formatDate(status.sessionInfo.lastActivity)}</span>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Instructions -->
      <div class="instructions">
        <h3>Test Instructions</h3>
        <ol>
          <li>Make sure tracking is enabled</li>
          <li>Navigate to different websites</li>
          <li>Switch between tabs</li>
          <li>Refresh this page to see updated activity</li>
          <li>Check the browser console for detailed logs</li>
        </ol>
      </div>
    </div>
  {/if}
</div>

<style>
  .activity-test {
    padding: 1rem;
    max-width: 600px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    flex: 1;
  }

  .icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .refresh-button {
    padding: 0.5rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    background: var(--background, #ffffff);
    cursor: pointer;
    transition: all 0.2s;
  }

  .refresh-button:hover:not(:disabled) {
    background: var(--background-hover, #f9fafb);
  }

  .refresh-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .loading, .error {
    text-align: center;
    padding: 2rem;
  }

  .error {
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.375rem;
  }

  .status-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .control-section, .settings-section, .activity-section, .session-section, .instructions {
    padding: 1rem;
    background: var(--background-secondary, #f9fafb);
    border-radius: 0.5rem;
    border: 1px solid var(--border-color, #e5e7eb);
  }

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .control-buttons {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .control-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    background: var(--background, #ffffff);
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
  }

  .control-button:hover:not(:disabled) {
    background: var(--background-hover, #f9fafb);
  }

  .control-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .control-button.start {
    color: #16a34a;
    border-color: #16a34a;
  }

  .control-button.stop {
    color: #dc2626;
    border-color: #dc2626;
  }

  .status-indicator {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    text-align: center;
    font-weight: 500;
  }

  .status-indicator.enabled {
    background: #f0fdf4;
    color: #16a34a;
    border-color: #bbf7d0;
  }

  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .setting-item, .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .setting-item .label, .detail-item .label {
    font-weight: 500;
    color: var(--text-muted, #6b7280);
  }

  .setting-item .value, .detail-item .value {
    font-family: monospace;
    font-size: 0.875rem;
  }

  .activity-card, .session-card {
    background: var(--background, #ffffff);
    border: 1px solid var(--border-color, #e5e7eb);
    border-radius: 0.375rem;
    padding: 1rem;
  }

  .activity-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color, #e5e7eb);
  }

  .activity-title {
    font-weight: 600;
    flex: 1;
    margin-right: 1rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .activity-status {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    background: #f3f4f6;
    color: #6b7280;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .activity-status.active {
    background: #dcfce7;
    color: #16a34a;
  }

  .activity-details, .session-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .url {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .session-id {
    font-size: 0.75rem;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .no-activity {
    text-align: center;
    padding: 2rem;
    color: var(--text-muted, #6b7280);
  }

  .instructions ol {
    margin: 0;
    padding-left: 1.5rem;
  }

  .instructions li {
    margin-bottom: 0.5rem;
  }
</style>

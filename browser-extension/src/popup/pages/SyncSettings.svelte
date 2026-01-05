<!--
  Sync Settings Page
  Dedicated page for managing activity and history sync settings with card-based grid layout
-->

<script lang="ts">
  import { onMount, onDestroy } from "svelte"
  import { ActivityService } from "../../lib/services/activity.service"
  import { HistorySyncService } from "../../lib/services/history-sync.service"
  import type { ActivityStatus } from "../../lib/services/activity.service"
  import type { HistorySyncStatus } from "../../lib/services/history-sync.service"
  import {
    Activity,
    History,
    Clock,
    Upload,
    Database,
    RefreshCw
  } from "lucide-svelte"
  import { watchStorage } from "../../lib/services/plasmo-storage.service"

  export let onBack: () => void

  let activityStatus: ActivityStatus | null = null
  let historyStatus: HistorySyncStatus | null = null
  let loading = true
  let error: string | null = null
  let updatingSettings = false
  let storageWatchUnsubscribe: (() => void) | null = null

  // Local state variables for settings
  let syncEnabled = false
  let syncInterval = 30
  let minimumDuration = 5
  let hasLoadedInitialValues = false

  function syncLocalStateFromActivityStatus() {
    if (activityStatus?.settings) {
      console.log("[SyncSettings] Syncing local state from activityStatus", {
        syncEnabled: activityStatus.settings.syncEnabled,
        hasLoadedInitialValues
      })
      syncEnabled = activityStatus.settings.syncEnabled ?? false
      syncInterval = activityStatus.settings.syncInterval ?? 30
      minimumDuration = activityStatus.settings.minimumDuration ?? 5
      hasLoadedInitialValues = true
    }
  }

  onMount(async () => {
    await testBackgroundConnectivity()
    loadStatus()

    try {
      storageWatchUnsubscribe = watchStorage.watchActivitySettings(
        (settings) => {
          console.log(
            "[SyncSettings] Storage watcher detected settings change:",
            settings
          )
          if (settings && activityStatus && !updatingSettings) {
            activityStatus.settings = settings
            syncLocalStateFromActivityStatus()
            console.log(
              "[SyncSettings] Updated activityStatus from storage watcher"
            )
          }
        }
      )
      console.log("[SyncSettings] Storage watcher initialized successfully")
    } catch (watchError) {
      console.warn(
        "[SyncSettings] Failed to initialize storage watcher:",
        watchError
      )
      storageWatchUnsubscribe = null
    }
  })

  async function testBackgroundConnectivity() {
    try {
      console.log("[SyncSettings] Testing background connectivity...")
      console.log("[SyncSettings] Skipping background connectivity test")
    } catch (err) {
      console.error("[SyncSettings] Background connectivity test failed:", err)
      error =
        "Cannot connect to background service. Please reload the extension."
    }
  }

  onDestroy(() => {
    if (
      storageWatchUnsubscribe &&
      typeof storageWatchUnsubscribe === "function"
    ) {
      storageWatchUnsubscribe()
      storageWatchUnsubscribe = null
    }
  })

  async function loadStatus(showLoading = true) {
    if (showLoading) {
      loading = true
    }
    error = null

    try {
      activityStatus = await ActivityService.getStatus()
      console.log("Loaded activityStatus from background:", activityStatus)
      historyStatus = await HistorySyncService.getStatus()

      if (activityStatus && !activityStatus.settings) {
        activityStatus.settings = {
          enabled: true,
          syncEnabled: false,
          incognitoMode: "mark",
          heartbeatInterval: 30,
          syncInterval: 30,
          minimumDuration: 5,
          domainBlacklist: [],
          autoCleanupDays: 30
        }
      }

      if (
        activityStatus?.settings &&
        typeof activityStatus.settings.syncEnabled !== "boolean"
      ) {
        activityStatus.settings.syncEnabled = false
      }

      if (activityStatus && !activityStatus.syncStatus) {
        activityStatus.syncStatus = {
          enabled: activityStatus.settings?.syncEnabled || false,
          running: false,
          interval: activityStatus.settings?.syncInterval || 30,
          lastSync: null,
          itemsQueued: 0,
          totalSynced: 0
        }
      }

      if (historyStatus && !historyStatus.syncStatus) {
        historyStatus.syncStatus = {
          enabled: false,
          running: historyStatus.state?.syncInProgress || false,
          interval: 300,
          lastSync: historyStatus.checkpoint?.lastSyncTime || null,
          itemsQueued: 0,
          totalSynced: historyStatus.checkpoint?.totalSynced || 0
        }
      }

      syncLocalStateFromActivityStatus()
    } catch (err) {
      error = "Failed to load sync status"
      console.error("Failed to load sync status:", err)
    } finally {
      if (showLoading) {
        loading = false
      }
    }
  }

  async function updateActivitySettings(updates: any) {
    if (!activityStatus) {
      console.error("Cannot update settings: activityStatus is null")
      return
    }

    updatingSettings = true

    try {
      if (!activityStatus.settings) {
        activityStatus.settings = {
          enabled: true,
          syncEnabled: false,
          incognitoMode: "mark",
          heartbeatInterval: 30,
          syncInterval: 30,
          minimumDuration: 5,
          domainBlacklist: [],
          autoCleanupDays: 30
        }
      }

      activityStatus.settings = { ...activityStatus.settings, ...updates }

      syncEnabled = updates.syncEnabled ?? syncEnabled
      syncInterval = updates.syncInterval ?? syncInterval
      minimumDuration = updates.minimumDuration ?? minimumDuration

      const result = await ActivityService.updateSettings(updates)

      if (!result) {
        throw new Error("Background service returned false")
      }

      await new Promise((resolve) => setTimeout(resolve, 100))
      await loadStatus(false)
    } catch (err) {
      console.error("[SyncSettings] Failed to update activity settings:", err)
      await loadStatus(false)
      error = `Failed to update settings: ${err instanceof Error ? err.message : String(err)}`
      setTimeout(() => {
        error = null
      }, 3000)
    } finally {
      updatingSettings = false
    }
  }

  async function triggerActivitySync() {
    try {
      await ActivityService.startTracking()
      await loadStatus(false)
    } catch (err) {
      console.error("Failed to trigger activity sync:", err)
    }
  }

  async function triggerHistorySync() {
    try {
      await HistorySyncService.syncFullHistory()
      await loadStatus(false)
    } catch (err) {
      console.error("Failed to trigger history sync:", err)
    }
  }

  function formatLastSync(lastSync: Date | string | null | undefined): string {
    if (!lastSync) return "Never"

    const date = new Date(lastSync)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)

    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`
    } else if (diffHours < 24) {
      return `${diffHours}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }
</script>

<div class="max-w-[400px] mx-auto p-6">
  <!-- Header -->
  <div class="section-header">
    <button class="back-btn" on:click={onBack}>←</button>
    <h1 class="section-title">Sync Settings</h1>
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p class="text-sm text-muted-foreground">Loading sync status...</p>
    </div>
  {:else if error}
    <div class="flex flex-col items-center justify-center gap-4 py-10">
      <p class="text-destructive text-sm">{error}</p>
      <button class="btn-primary" on:click={() => loadStatus()}>Retry</button>
    </div>
  {:else}
    <div class="flex flex-col gap-5">
      <!-- Activity Sync Card -->
      {#if activityStatus?.settings}
        <div class="card p-0 overflow-hidden">
          <span class="card-corner-bl"></span>
          <span class="card-corner-br"></span>
          
          <!-- Card Header -->
          <div class="flex items-start gap-4 p-5 border-b border-border bg-muted/50">
            <div class="w-12 h-12 flex items-center justify-center bg-card shrink-0">
              <Activity size={24} class="text-green-500" />
            </div>
            <div class="flex-1">
              <h2 class="text-lg font-semibold text-foreground">Activity Sync</h2>
              <p class="text-sm text-muted-foreground">Real-time browsing activity tracking</p>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full {activityStatus.syncStatus?.enabled ? (activityStatus.syncStatus?.running ? 'bg-green-500' : 'bg-amber-500') : 'bg-muted-foreground'}"></div>
              <span class="text-xs text-muted-foreground font-medium">
                {activityStatus.syncStatus?.enabled
                  ? activityStatus.syncStatus?.isTracking
                    ? activityStatus.syncStatus?.running
                      ? "Running"
                      : "Active"
                    : activityStatus.syncStatus?.running
                      ? "Running"
                      : "Idle"
                  : "Disabled"}
              </span>
            </div>
          </div>

          <!-- Card Content -->
          <div class="p-5 flex flex-col gap-5">
            <!-- Enable Toggle -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-foreground">Enable Activity Sync</span>
                <label class="relative inline-block w-11 h-6 cursor-pointer">
                  <input
                    type="checkbox"
                    class="opacity-0 w-0 h-0"
                    bind:checked={syncEnabled}
                    on:change={() => updateActivitySettings({ syncEnabled })}
                    disabled={updatingSettings} />
                  <span class="absolute inset-0 bg-border rounded-full transition-colors duration-200 {syncEnabled ? 'bg-primary' : ''}"></span>
                  <span class="absolute w-[18px] h-[18px] left-[3px] bottom-[3px] bg-white rounded-full transition-transform duration-200 {syncEnabled ? 'translate-x-5' : ''}"></span>
                </label>
                {#if updatingSettings}
                  <div class="spinner-sm"></div>
                {/if}
              </div>
              <p class="text-xs text-muted-foreground">
                Track and sync your browsing activity in real-time
              </p>
            </div>

            <!-- Sync Interval -->
            <div class="flex flex-col gap-2">
              <label class="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock size={16} />
                <span>Sync Interval</span>
              </label>
              <div class="radio-group">
                {#each [30, 60, 300, 600] as interval}
                  <label class="radio-option">
                    <input
                      type="radio"
                      name="sync-interval"
                      value={interval}
                      bind:group={syncInterval}
                      on:change={() => updateActivitySettings({ syncInterval })}
                      disabled={!syncEnabled} />
                    <span class="text-xs font-medium">
                      {interval < 60 ? `${interval}s` : interval < 3600 ? `${interval / 60}m` : `${interval / 3600}h`}
                    </span>
                  </label>
                {/each}
              </div>
              <p class="text-xs text-muted-foreground">
                How often to sync data to the server
              </p>
            </div>

            <!-- Minimum Duration -->
            <div class="flex flex-col gap-2">
              <label class="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock size={16} />
                <span>Minimum Duration</span>
              </label>
              <div class="radio-group">
                {#each [0, 3, 5, 10] as duration}
                  <label class="radio-option">
                    <input
                      type="radio"
                      name="minimum-duration"
                      value={duration}
                      bind:group={minimumDuration}
                      on:change={() => updateActivitySettings({ minimumDuration })}
                      disabled={!syncEnabled} />
                    <span class="text-xs font-medium">
                      {duration === 0 ? 'All' : `${duration}s`}
                    </span>
                  </label>
                {/each}
              </div>
              <p class="text-xs text-muted-foreground">
                Minimum time spent on a page to record it
              </p>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-3 gap-2 p-3 bg-muted">
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Last Sync</span>
                <span class="text-sm font-semibold text-foreground font-mono">{formatLastSync(activityStatus.syncStatus?.lastSync)}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Queued</span>
                <span class="text-sm font-semibold text-foreground font-mono">{activityStatus.syncStatus?.itemsQueued || 0}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Total</span>
                <span class="text-sm font-semibold text-foreground font-mono">{activityStatus.syncStatus?.totalSynced?.toLocaleString() || "0"}</span>
              </div>
            </div>

            <!-- Action -->
            <button
              class="btn-primary w-full"
              on:click={triggerActivitySync}
              disabled={!syncEnabled}>
              <RefreshCw size={16} />
              Sync Now
            </button>
          </div>
        </div>
      {/if}

      <!-- History Sync Card -->
      {#if historyStatus}
        <div class="card p-0 overflow-hidden">
          <span class="card-corner-bl"></span>
          <span class="card-corner-br"></span>
          
          <!-- Card Header -->
          <div class="flex items-start gap-4 p-5 border-b border-border bg-muted/50">
            <div class="w-12 h-12 flex items-center justify-center bg-card shrink-0">
              <History size={24} class="text-amber-500" />
            </div>
            <div class="flex-1">
              <h2 class="text-lg font-semibold text-foreground">History Sync</h2>
              <p class="text-sm text-muted-foreground">Browser history synchronization</p>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full {historyStatus.syncStatus?.enabled ? (historyStatus.syncStatus?.running ? 'bg-green-500' : 'bg-amber-500') : 'bg-muted-foreground'}"></div>
              <span class="text-xs text-muted-foreground font-medium">
                {historyStatus.syncStatus?.enabled
                  ? historyStatus.syncStatus?.running
                    ? "Running"
                    : "Idle"
                  : "Disabled"}
              </span>
            </div>
          </div>

          <!-- Card Content -->
          <div class="p-5 flex flex-col gap-5">
            <!-- Enable Toggle -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-3">
                <input
                  type="checkbox"
                  class="w-4 h-4 accent-primary"
                  checked={historyStatus.syncStatus?.enabled || false}
                  on:change={() => {
                    /* TODO: Implement history sync enable/disable */
                  }} />
                <span class="text-sm font-medium text-foreground">Enable History Sync</span>
              </div>
              <p class="text-xs text-muted-foreground">
                Sync your browser history to the server
              </p>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-2 gap-3 p-4 bg-muted">
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Last Sync</span>
                <span class="text-sm font-semibold text-foreground font-mono">{formatLastSync(historyStatus.checkpoint.lastSyncTime)}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Total Synced</span>
                <span class="text-sm font-semibold text-foreground font-mono">{historyStatus.checkpoint.totalSynced.toLocaleString()}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Batches Synced</span>
                <span class="text-sm font-semibold text-foreground font-mono">{historyStatus.checkpoint.batchesSynced}</span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Failed Batches</span>
                <span class="text-sm font-semibold text-foreground font-mono">{historyStatus.checkpoint.failedBatches}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-3">
              <button
                class="btn-primary flex-1"
                on:click={triggerHistorySync}
                disabled={!historyStatus.syncStatus?.enabled}>
                <Database size={16} />
                Sync Full History
              </button>
              <button
                class="btn-secondary flex-1"
                on:click={() => HistorySyncService.syncIncrementalHistory()}
                disabled={!historyStatus.syncStatus?.enabled}>
                <Upload size={16} />
                Incremental Sync
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

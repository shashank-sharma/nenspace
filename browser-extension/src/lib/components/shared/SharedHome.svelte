<script lang="ts">
  import { onMount } from "svelte"
  import { authStorage } from "../../services/plasmo-storage.service"
  import { authFlowService } from "../../../features/auth/services/auth-flow.service"
  import { ActivityService } from "../../services/activity.service"
  import { HistorySyncService } from "../../services/history-sync.service"
  import type { StoredAuth } from "../../types/index"
  import type { ActivityStatus } from "../../services/activity.service"
  import type { HistorySyncStatus } from "../../services/history-sync.service"
  import IconSettings from "../icons/IconSettings.svelte"
  import IconLogout from "../icons/IconLogout.svelte"
  import { Shield, Server } from "lucide-svelte"
  import SyncStatusIndicator from "../SyncStatusIndicator.svelte"
  import { getBuildDisplayInfo } from "../../config/build-info"
  import { createLogger } from "../../utils/logger.util"

  const logger = createLogger("[SharedHome]")

  export let onNavigateToSettings: () => void
  export let onNavigateToSyncSettings: () => void
  export let onLogout: (() => void) | undefined = undefined
  export let compact = false

  let authData: StoredAuth | null = null
  let isLoading = true
  let buildInfo = getBuildDisplayInfo()
  let activityStatus: ActivityStatus | null = null
  let historyStatus: HistorySyncStatus | null = null
  let loadingSyncStatus = false

  onMount(async () => {
    const authResult = await authStorage.get()
    authData = authResult.success ? authResult.data : null

    // Load sync status if authenticated
    if (authData) {
      loadingSyncStatus = true
      try {
        const status = await ActivityService.getStatus()
        if (status && !status.syncStatus) {
          status.syncStatus = {
            enabled: status.settings?.syncEnabled || false,
            running: false,
            interval: status.settings?.syncInterval || 30,
            lastSync: null,
            itemsQueued: 0,
            totalSynced: 0
          }
        }
        activityStatus = status
      } catch (error) {
        logger.error("Failed to load activity status", error)
        activityStatus = null
      }

      try {
        const status = await HistorySyncService.getStatus()
        if (status && !status.syncStatus) {
          status.syncStatus = {
            enabled: false,
            running: status.state?.syncInProgress || false,
            interval: 300,
            lastSync: status.checkpoint?.lastSyncTime || null,
            itemsQueued: 0,
            totalSynced: status.checkpoint?.totalSynced || 0
          }
        }
        historyStatus = status
      } catch (error) {
        logger.error("Failed to load history sync status", error)
        historyStatus = null
      }
      loadingSyncStatus = false
    }

    isLoading = false
  })

  async function handleLogout() {
    try {
      await authFlowService.logout()
      if (onLogout) {
        onLogout()
      } else {
        window.location.reload()
      }
    } catch (error) {
      logger.error("Logout failed", error)
    }
  }
</script>

<div class="min-h-[300px] {compact ? 'min-h-[200px]' : ''}">
  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p class="text-sm text-muted-foreground">Loading...</p>
    </div>
  {:else if authData}
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-foreground mb-2">Dashboard</h1>
      <p class="text-sm text-muted-foreground">{authData.email}</p>
    </div>

    <!-- Info Cards -->
    <div class="grid grid-cols-1 gap-3 mb-5">
      <!-- Authenticated Card -->
      <div class="card p-3">
        <span class="card-corner-bl"></span>
        <span class="card-corner-br"></span>
        <div class="flex gap-3">
          <div class="info-card-icon">
            <Shield size={16} class="text-green-500" />
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-foreground">Authenticated</h3>
            <p class="text-xs text-muted-foreground">Logged in as {authData.email.split('@')[0] || "User"}</p>
          </div>
        </div>
      </div>

      <!-- Backend Card -->
      <div class="card p-3">
        <span class="card-corner-bl"></span>
        <span class="card-corner-br"></span>
        <div class="flex gap-3">
          <div class="info-card-icon">
            <Server size={16} class="text-blue-500" />
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold text-foreground">Backend</h3>
            <p class="text-xs text-muted-foreground font-mono break-all">{authData.backendUrl}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Sync Status Section -->
    {#if loadingSyncStatus}
      <div class="mb-5">
        <h2 class="text-sm font-semibold text-foreground mb-2.5">Sync Status</h2>
        <div class="flex flex-col items-center justify-center gap-3 py-5">
          <div class="spinner-sm"></div>
          <p class="text-sm text-muted-foreground">Loading sync status...</p>
        </div>
      </div>
    {:else if (activityStatus && activityStatus.syncStatus) || (historyStatus && historyStatus.syncStatus)}
      <div class="mb-5">
        <h2 class="text-sm font-semibold text-foreground mb-2.5">Sync Status</h2>
        <div class="grid grid-cols-1 gap-2.5">
          {#if activityStatus && activityStatus.syncStatus}
            <SyncStatusIndicator
              type="activity"
              status={activityStatus.syncStatus}
              onClick={onNavigateToSyncSettings} />
          {/if}
          {#if historyStatus && historyStatus.syncStatus}
            <SyncStatusIndicator
              type="history"
              status={historyStatus.syncStatus}
              onClick={onNavigateToSyncSettings} />
          {/if}
        </div>
      </div>
    {/if}

    <!-- Quick Actions -->
    <div class="flex gap-3">
      <button class="btn-secondary flex-1" on:click={onNavigateToSettings}>
        <IconSettings size={18} />
        Settings
      </button>
      <button class="btn-danger flex-1" on:click={handleLogout}>
        <IconLogout size={18} />
        Logout
      </button>
    </div>

    <!-- Build Information -->
    <div class="card p-4 mt-6 {compact ? 'mt-4 p-3' : ''}">
      <span class="card-corner-bl"></span>
      <span class="card-corner-br"></span>
      <div class="flex flex-col gap-2 text-xs">
        <div class="flex justify-between items-center">
          <span class="text-muted-foreground font-medium">Built:</span>
          <span class="text-foreground font-mono text-[11px]" title={buildInfo.timestamp}>
            {buildInfo.relative}
          </span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-muted-foreground font-medium">Version:</span>
          <span class="text-foreground font-mono text-[11px]">{buildInfo.version}</span>
        </div>
        {#if buildInfo.environment && buildInfo.environment !== "production"}
          <div class="flex justify-between items-center">
            <span class="text-muted-foreground font-medium">Env:</span>
            <span class="font-mono text-[11px] {buildInfo.environment === 'development' ? 'text-yellow-400' : buildInfo.environment === 'staging' ? 'text-orange-400' : 'text-purple-400'}">
              {buildInfo.environment}
            </span>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p class="text-muted-foreground">No authentication data found</p>
    </div>
  {/if}
</div>

<!--
  Sync Status Indicator Component
  Shows sync status for activity or history sync with green indicator, interval, and last sync time
-->

<script lang="ts">
  import { Activity, History, Clock, Upload } from 'lucide-svelte'
  
  export let type: 'activity' | 'history'
  export let status: {
    enabled: boolean
    running: boolean
    interval: number
    lastSync?: Date | string | null
    itemsQueued?: number
    totalSynced?: number
    isTracking?: boolean
  }
  export let onClick: () => void = () => {}
  
  function formatInterval(seconds: number): string {
    if (seconds < 60) {
      return `Every ${seconds}s`
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      return `Every ${minutes}m`
    } else {
      const hours = Math.floor(seconds / 3600)
      return `Every ${hours}h`
    }
  }
  
  function formatLastSync(lastSync: Date | string | null | undefined): string {
    if (!lastSync) return 'Never'
    
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
  
  function getStatusColor(): string {
    if (!status.enabled) return 'bg-muted-foreground'
    if (status.running) return 'bg-green-500'
    return 'bg-amber-500'
  }
  
  function getStatusText(): string {
    if (!status.enabled) return 'Disabled'
    // Show "Active" if tracking is active, "Running" if sync is in progress, otherwise "Idle"
    if (status.isTracking !== undefined && status.isTracking) {
      return status.running ? 'Running' : 'Active'
    }
    if (status.running) return 'Running'
    return 'Idle'
  }
</script>

<button 
  class="card p-3 w-full text-left cursor-pointer transition-all hover:bg-muted hover:border-primary hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
  on:click={onClick}
  on:keydown={(e) => e.key === 'Enter' && onClick()}
  type="button"
>
  <span class="card-corner-bl"></span>
  <span class="card-corner-br"></span>
  
  <div class="flex flex-col gap-2.5">
    <!-- Header -->
    <div class="flex items-start gap-3">
      <div class="info-card-icon">
        {#if type === 'activity'}
          <Activity size={18} class="text-green-500" />
        {:else}
          <History size={18} class="text-blue-500" />
        {/if}
      </div>
      <div class="flex-1">
        <h3 class="text-sm font-semibold text-foreground">
          {type === 'activity' ? 'Activity Sync' : 'History Sync'}
        </h3>
        <div class="flex items-center gap-1.5">
          <div class="w-2 h-2 rounded-full shrink-0 {getStatusColor()}"></div>
          <span class="text-xs text-muted-foreground font-medium">{getStatusText()}</span>
        </div>
      </div>
    </div>
    
    <!-- Details -->
    <div class="flex flex-col gap-1">
      <div class="flex items-center gap-1.5 text-[11px]">
        <Clock size={14} class="text-muted-foreground" />
        <span class="text-muted-foreground font-medium min-w-[50px]">Interval:</span>
        <span class="text-foreground font-mono text-[10px]">{formatInterval(status.interval)}</span>
      </div>
      
      <div class="flex items-center gap-1.5 text-[11px]">
        <Upload size={14} class="text-muted-foreground" />
        <span class="text-muted-foreground font-medium min-w-[50px]">Last sync:</span>
        <span class="text-foreground font-mono text-[10px]">{formatLastSync(status.lastSync)}</span>
      </div>
      
      {#if status.itemsQueued !== undefined && status.itemsQueued > 0}
        <div class="flex items-center gap-1.5 text-[11px]">
          <span class="text-muted-foreground font-medium min-w-[50px]">Queued:</span>
          <span class="text-foreground font-mono text-[10px]">{status.itemsQueued} items</span>
        </div>
      {/if}
      
      {#if status.totalSynced !== undefined}
        <div class="flex items-center gap-1.5 text-[11px]">
          <span class="text-muted-foreground font-medium min-w-[50px]">Total synced:</span>
          <span class="text-foreground font-mono text-[10px]">{status.totalSynced.toLocaleString()}</span>
        </div>
      {/if}
    </div>
  </div>
</button>

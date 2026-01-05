<script lang="ts">
  import { Card, CardContent } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
  } from '$lib/components/ui/dropdown-menu'
  import { Input } from '$lib/components/ui/input'
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
  } from '$lib/components/ui/dialog'
  import { syncStore } from '../stores'
  import { vaultStore } from '../stores'
  import { Folder, CheckCircle2, Loader2, XCircle, Clock, AlertCircle, ChevronDown, FolderPlus } from 'lucide-svelte'
  import { DateUtil } from '$lib/utils'
  import { NotificationBroadcaster } from '$lib/features/status-indicator'

  const syncState = $derived(syncStore.state)
  const isSyncing = $derived(syncState.status === 'syncing')
  const hasError = $derived(syncState.status === 'error')
  const isIdle = $derived(syncState.status === 'idle')
  const lastSynced = $derived(syncState.lastSync)
  const pendingChanges = $derived(syncState.pendingChanges)
  const hasConflicts = $derived(syncState.conflicts.length > 0)

  let showCreateVaultDialog = $state(false)
  let newVaultName = $state('')
  let creatingVault = $state(false)

  async function handleSelectVault(vaultId: string) {
    try {
      await vaultStore.setActiveVault(vaultId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to select vault'
      NotificationBroadcaster.error(errorMessage, { duration: 5000 })
    }
  }

  async function handleCreateVault() {
    if (!newVaultName.trim()) return

    creatingVault = true
    try {
      const vault = await vaultStore.createVault(newVaultName.trim())
      await vaultStore.setActiveVault(vault.id)
      showCreateVaultDialog = false
      newVaultName = ''
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create vault'
      NotificationBroadcaster.error(errorMessage, { duration: 5000 })
    } finally {
      creatingVault = false
    }
  }
</script>

<Card class="markdown-status-bar">
  <CardContent class="p-3">
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild let:builder>
            <Button variant="ghost" size="sm" builders={[builder]} class="h-auto p-2">
              <div class="flex items-center gap-2">
                <Folder class="h-4 w-4 text-muted-foreground" />
                <span class="text-sm font-medium truncate max-w-[200px]">
                  {vaultStore.activeVault?.name || 'No Vault'}
                </span>
                <ChevronDown class="h-3 w-3 text-muted-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-56">
            {#each vaultStore.vaults as vault}
              <DropdownMenuItem
                on:click={() => handleSelectVault(vault.id)}
                class={vault.id === vaultStore.activeVaultId ? 'bg-accent' : ''}
              >
                <Folder class="h-4 w-4 mr-2" />
                <span class="flex-1">{vault.name}</span>
                {#if vault.id === vaultStore.activeVaultId}
                  <CheckCircle2 class="h-4 w-4 text-green-500" />
                {/if}
              </DropdownMenuItem>
            {/each}
            <DropdownMenuSeparator />
            <DropdownMenuItem on:click={() => showCreateVaultDialog = true}>
              <FolderPlus class="h-4 w-4 mr-2" />
              <span>Create New Vault</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div class="flex items-center gap-4">
        {#if isSyncing}
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 class="h-4 w-4 animate-spin" />
            <span>Syncing...</span>
          </div>
        {:else if hasError}
          <div class="flex items-center gap-2 text-sm text-destructive" title={syncState.error || 'Sync failed'}>
            <XCircle class="h-4 w-4 text-destructive" />
            <span class="max-w-md truncate">Sync failed</span>
          </div>
        {:else if hasConflicts}
          <div class="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500" title="Conflicts detected">
            <AlertCircle class="h-4 w-4" />
            <span>{syncState.conflicts.length} conflict{syncState.conflicts.length === 1 ? '' : 's'}</span>
          </div>
        {:else if isIdle && lastSynced}
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 class="h-4 w-4 text-green-500" />
            <span>Synced</span>
          </div>
        {:else if isIdle}
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 class="h-4 w-4 text-green-500" />
            <span>Ready</span>
          </div>
        {/if}

        {#if lastSynced && !hasError}
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock class="h-4 w-4" />
            <span>
              {DateUtil.formatRelative(lastSynced)}
            </span>
          </div>
        {/if}

        {#if pendingChanges > 0 && !isSyncing}
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{pendingChanges} pending change{pendingChanges === 1 ? '' : 's'}</span>
          </div>
        {/if}

        {#if hasError && syncState.error}
          <div class="text-xs text-destructive max-w-md truncate" title={syncState.error}>
            {syncState.error}
          </div>
        {/if}
      </div>
    </div>
  </CardContent>
</Card>

<style>
  .markdown-status-bar {
    flex-shrink: 0;
    z-index: 10;
  }
</style>

<Dialog bind:open={showCreateVaultDialog}>
  <DialogContent class="max-w-md">
    <DialogHeader>
      <DialogTitle>Create New Vault</DialogTitle>
      <DialogDescription>
        Enter a name for your new vault
      </DialogDescription>
    </DialogHeader>

    <div class="space-y-4">
      <div>
        <Input
          bind:value={newVaultName}
          placeholder="Vault name"
          on:keydown={(e) => {
            if (e.key === 'Enter' && !creatingVault && newVaultName.trim()) {
              handleCreateVault()
            }
          }}
          disabled={creatingVault}
        />
      </div>
    </div>

    <DialogFooter>
      <Button variant="outline" on:click={() => showCreateVaultDialog = false} disabled={creatingVault}>
        Cancel
      </Button>
      <Button on:click={handleCreateVault} disabled={creatingVault || !newVaultName.trim()}>
        {#if creatingVault}
          <Loader2 class="w-4 h-4 mr-2 animate-spin" />
        {:else}
          <FolderPlus class="w-4 h-4 mr-2" />
        {/if}
        Create
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>


<script lang="ts">
  import { onMount } from 'svelte'
  import { vaultStore } from '../stores'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
  } from '$lib/components/ui/dialog'
  import { NotificationBroadcaster } from '$lib/features/status-indicator'
  import { FolderPlus, FolderOpen, Loader2 } from 'lucide-svelte'

  interface Props {
    open?: boolean
  }

  let { open = $bindable(true) }: Props = $props()

  let vaultName = $state('')
  let creating = $state(false)
  let loading = $state(false)

  onMount(async () => {
    await vaultStore.initialize()
    if (vaultStore.vaults.length > 0 && !vaultStore.activeVault) {
      vaultStore.setActiveVault(vaultStore.vaults[0].id)
    }
  })

  async function handleCreateVault() {
    if (!vaultName.trim()) return

    creating = true
    try {
      const vault = await vaultStore.createVault(vaultName.trim())
      await vaultStore.setActiveVault(vault.id)
      open = false
      vaultName = ''
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create vault'
      NotificationBroadcaster.error(errorMessage, { duration: 5000 })
    } finally {
      creating = false
    }
  }

  async function handleSelectVault(vaultId: string) {
    loading = true
    try {
      await vaultStore.setActiveVault(vaultId)
      open = false
    } catch {
    } finally {
      loading = false
    }
  }
</script>

<Dialog bind:open>
  <DialogContent class="max-w-md">
    <DialogHeader>
      <DialogTitle>Select or Create Vault</DialogTitle>
      <DialogDescription>
        Choose an existing vault or create a new one to start taking notes
      </DialogDescription>
    </DialogHeader>

    <div class="space-y-4">
      {#if vaultStore.vaults.length > 0}
        <div>
          <Label class="mb-2 block">Existing Vaults</Label>
          <div class="space-y-2 max-h-64 overflow-auto">
            {#each vaultStore.vaults as vault}
              <Button
                variant={vault.id === vaultStore.activeVaultId ? "default" : "outline"}
                class="w-full justify-start"
                on:click={() => handleSelectVault(vault.id)}
                disabled={loading}
              >
                <FolderOpen class="w-4 h-4 mr-2" />
                <span class="flex-1 text-left">{vault.name}</span>
                {#if vault.id === vaultStore.activeVaultId}
                  <span class="text-xs text-muted-foreground">Active</span>
                {/if}
              </Button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="border-t pt-4">
        <Label for="vault-name" class="mb-2 block">Create New Vault</Label>
        <div class="flex gap-2">
          <Input
            id="vault-name"
            bind:value={vaultName}
            placeholder="Vault name"
            on:keydown={(e) => {
              if (e.key === 'Enter' && !creating) {
                handleCreateVault()
              }
            }}
            disabled={creating}
          />
          <Button
            on:click={handleCreateVault}
            disabled={creating || !vaultName.trim()}
          >
            {#if creating}
              <Loader2 class="w-4 h-4 mr-2 animate-spin" />
            {:else}
              <FolderPlus class="w-4 h-4 mr-2" />
            {/if}
            Create
          </Button>
        </div>
      </div>
    </div>

    <DialogFooter>
      {#if vaultStore.activeVault}
        <Button variant="outline" on:click={() => open = false}>Cancel</Button>
      {/if}
    </DialogFooter>
  </DialogContent>
</Dialog>


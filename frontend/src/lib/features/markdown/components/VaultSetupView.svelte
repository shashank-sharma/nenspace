<script lang="ts">
  import { onMount } from 'svelte'
  import { vaultStore } from '../stores'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import {
    Select as SelectRoot,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
  } from '$lib/components/ui/select'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { NotificationBroadcaster } from '$lib/features/status-indicator'
  import {
    FolderPlus,
    FolderOpen,
    Cloud,
    FileText,
    Zap,
    Shield,
    Loader2,
    CheckCircle2,
    ArrowRight,
    Database,
    Lock
  } from 'lucide-svelte'

  let vaultName = $state('')
  let selectedVaultId = $state<string | null>(null)
  let creating = $state(false)
  let loading = $state(false)
  let showCreateForm = $state(false)

  onMount(async () => {
    await vaultStore.initialize()
    if (vaultStore.vaults.length > 0) {
      selectedVaultId = vaultStore.activeVaultId || vaultStore.vaults[0].id
    } else {
      showCreateForm = true
    }
  })

  $effect(() => {
    if (vaultStore.vaults.length === 0) {
      showCreateForm = true
    }
  })

  async function handleSelectVault() {
    if (!selectedVaultId) return

    loading = true
    try {
      await vaultStore.setActiveVault(selectedVaultId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to select vault'
      NotificationBroadcaster.error(errorMessage, { duration: 5000 })
    } finally {
      loading = false
    }
  }

  async function handleCreateVault() {
    if (!vaultName.trim()) return

    creating = true
    try {
      const vault = await vaultStore.createVault(vaultName.trim())
      selectedVaultId = vault.id
      vaultName = ''
      showCreateForm = false
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create vault'
      NotificationBroadcaster.error(errorMessage, { duration: 5000 })
    } finally {
      creating = false
    }
  }

  function toggleCreateForm() {
    showCreateForm = !showCreateForm
    if (showCreateForm) {
      selectedVaultId = null
    }
  }
</script>

<div class="vault-setup-view h-full flex items-center justify-center p-8 bg-gradient-to-br from-background to-muted/20">
  <div class="w-full max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="text-center space-y-4">
      <div class="flex justify-center">
        <div class="relative">
          <div class="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
          <div class="relative bg-primary/10 p-6 rounded-2xl">
            <FolderOpen class="w-16 h-16 text-primary" />
          </div>
        </div>
      </div>
      <div>
        <h1 class="text-4xl font-bold mb-2">Welcome to Notes</h1>
        <p class="text-lg text-muted-foreground max-w-2xl mx-auto">
          Create a vault to organize your notes. A vault is like a workspace
          where all your notes, links, and attachments are stored.
        </p>
      </div>
    </div>

    <div class="grid md:grid-cols-3 gap-4 mb-8">
      <Card class="border-2 hover:border-primary/50 transition-colors">
        <CardHeader>
          <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <FileText class="w-6 h-6 text-primary" />
          </div>
          <CardTitle class="text-lg">Organized Notes</CardTitle>
          <CardDescription>
            Keep all your notes in one place with folders and tags
          </CardDescription>
        </CardHeader>
      </Card>

      <Card class="border-2 hover:border-primary/50 transition-colors">
        <CardHeader>
          <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <Zap class="w-6 h-6 text-primary" />
          </div>
          <CardTitle class="text-lg">Wiki Links</CardTitle>
          <CardDescription>
            Connect notes with [[wiki-links]] and visualize relationships
          </CardDescription>
        </CardHeader>
      </Card>

      <Card class="border-2 hover:border-primary/50 transition-colors">
        <CardHeader>
          <div class="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <Cloud class="w-6 h-6 text-primary" />
          </div>
          <CardTitle class="text-lg">Sync & Backup</CardTitle>
          <CardDescription>
            Sync across devices with PocketBase cloud storage
          </CardDescription>
        </CardHeader>
      </Card>
    </div>

    <Card class="border-2">
      <CardHeader>
        <CardTitle>Get Started</CardTitle>
        <CardDescription>
          {#if vaultStore.vaults.length > 0}
            Select an existing vault or create a new one
          {:else}
            Create your first vault to start taking notes
          {/if}
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-6">
        {#if vaultStore.vaults.length > 0 && !showCreateForm}
          <div class="space-y-4">
            <div>
              <Label for="vault-select">Select Vault</Label>
              <SelectRoot
                selected={
                  selectedVaultId
                    ? {
                        value: selectedVaultId,
                        label:
                          vaultStore.vaults.find(v => v.id === selectedVaultId)
                            ?.name || ''
                      }
                    : undefined
                }
                onSelectedChange={(value) => {
                  if (value) {
                    selectedVaultId = value.value
                  }
                }}
              >
                <SelectTrigger id="vault-select" class="w-full">
                  <SelectValue placeholder="Choose a vault" />
                </SelectTrigger>
                <SelectContent>
                  {#each vaultStore.vaults as vault}
                    <SelectItem value={vault.id}>
                      <div class="flex items-center gap-2 w-full">
                        <FolderOpen class="w-4 h-4" />
                        <div class="flex-1">
                          <div class="font-medium">{vault.name}</div>
                          <div class="text-xs text-muted-foreground">
                            {vault.syncEnabled ? 'Synced' : 'Local only'}
                          </div>
                        </div>
                        {#if vault.syncEnabled}
                          <Cloud class="w-3 h-3 text-muted-foreground" />
                        {/if}
                      </div>
                    </SelectItem>
                  {/each}
                </SelectContent>
              </SelectRoot>
            </div>

            <div class="flex gap-2">
              <Button
                on:click={handleSelectVault}
                disabled={!selectedVaultId || loading}
                class="flex-1"
                size="lg"
              >
                {#if loading}
                  <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                {:else}
                  <ArrowRight class="w-4 h-4 mr-2" />
                {/if}
                Open Vault
              </Button>
              <Button
                variant="outline"
                on:click={toggleCreateForm}
                size="lg"
              >
                <FolderPlus class="w-4 h-4 mr-2" />
                Create New
              </Button>
            </div>
          </div>
        {/if}

        {#if showCreateForm}
          <div class="space-y-4 animate-in fade-in slide-in-from-top-2">
            <div>
              <Label for="vault-name">Vault Name</Label>
              <Input
                id="vault-name"
                bind:value={vaultName}
                placeholder="My Notes"
                on:keydown={(e) => {
                  if (e.key === 'Enter' && !creating && vaultName.trim()) {
                    handleCreateVault()
                  }
                }}
                disabled={creating}
                class="text-lg"
              />
              <p class="text-xs text-muted-foreground mt-1">
                Choose a name for your vault. You can change this later.
              </p>
            </div>

            <div class="flex gap-2">
              <Button
                on:click={handleCreateVault}
                disabled={creating || !vaultName.trim()}
                class="flex-1"
                size="lg"
              >
                {#if creating}
                  <Loader2 class="w-4 h-4 mr-2 animate-spin" />
                {:else}
                  <FolderPlus class="w-4 h-4 mr-2" />
                {/if}
                Create Vault
              </Button>
              {#if vaultStore.vaults.length > 0}
                <Button
                  variant="outline"
                  on:click={toggleCreateForm}
                  disabled={creating}
                  size="lg"
                >
                  Cancel
                </Button>
              {/if}
            </div>

            <div class="pt-4 border-t space-y-3">
              <div class="flex items-start gap-3 text-sm">
                <Database class="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <div class="font-medium">Local Storage</div>
                  <div class="text-muted-foreground">
                    Notes are stored locally on your device for fast access
                  </div>
                </div>
              </div>
              <div class="flex items-start gap-3 text-sm">
                <Lock class="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <div class="font-medium">Private & Secure</div>
                  <div class="text-muted-foreground">
                    Your notes are encrypted and only accessible by you
                  </div>
                </div>
              </div>
              <div class="flex items-start gap-3 text-sm">
                <Cloud class="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <div class="font-medium">Optional Sync</div>
                  <div class="text-muted-foreground">
                    Enable cloud sync later to access notes from any device
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </CardContent>
    </Card>
  </div>
</div>

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slide-in-from-bottom-4 {
    from {
      transform: translateY(1rem);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slide-in-from-top-2 {
    from {
      transform: translateY(-0.5rem);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .animate-in {
    animation: fade-in 0.5s ease-out;
  }

  .fade-in {
    animation: fade-in 0.5s ease-out;
  }

  .slide-in-from-bottom-4 {
    animation: slide-in-from-bottom-4 0.5s ease-out;
  }

  .slide-in-from-top-2 {
    animation: slide-in-from-top-2 0.3s ease-out;
  }
</style>


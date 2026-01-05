<script lang="ts">
    import { onMount, untrack } from "svelte";
    import {
        Plus,
        RefreshCcw,
        KeyRound,
        Eye,
        EyeOff,
        Copy,
        Pencil,
        Trash2,
        BarChart3,
    } from "lucide-svelte";
    import * as Dialog from "$lib/components/ui/dialog";
    import UsageStatsCard from "./UsageStatsCard.svelte";
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
    import SearchInput from "$lib/components/SearchInput.svelte";
    import SecurityKeyDialog from "./SecurityKeyDialog.svelte";
    import type { SecurityKey } from "$lib/features/credentials/types";
    import { CredentialsService, SecurityKeysSyncService } from "../services";
    import { withErrorHandling, DateUtil } from "$lib/utils";
    import {
        useModalState,
        useDebouncedFilter,
        useAutoRefresh,
        useSyncListener,
    } from "$lib/hooks";
    import { createPageDebug, DebugSettings } from "$lib/utils/debug-helper";
    import ButtonControl from "$lib/components/debug/controls/ButtonControl.svelte";
    import SwitchControl from "$lib/components/debug/controls/SwitchControl.svelte";
    import { SEARCH_DEBOUNCE_MS } from "../constants";
    import { toast } from "svelte-sonner";
    import CredentialUsageCharts from "./CredentialUsageCharts.svelte";

    // State
    let securityKeys = $state<SecurityKey[]>([]);
    let isLoading = $state(true);
    let searchQuery = $state("");
    let showingPrivateKey = $state<Record<string, boolean>>({});
    let showStatsFor = $state<string | null>(null);
    let statsDialogOpen = $state(false);

    // Modal management using hook
    const modals = useModalState<SecurityKey>();
    let showDialog = $state(false);

    // Debug settings
    const debugSettings = new DebugSettings("security-keys-debug", {
        showInactive: false,
        autoRefresh: false,
        alwaysShowPrivate: false,
    });

    let showInactive = $state(debugSettings.get("showInactive"));
    let alwaysShowPrivate = $state(debugSettings.get("alwaysShowPrivate"));

    // Auto-refresh hook - eliminates manual interval management
    const autoRefresh = useAutoRefresh({
        refreshFn: () => loadSecurityKeys(true),
        intervalMs: 30000,
        initialEnabled: debugSettings.get("autoRefresh"),
    });

    // Filtered security keys based on search and debug settings
    let filteredKeys = $derived.by(() => {
        let filtered = showInactive
            ? securityKeys
            : securityKeys.filter((key) => key.is_active);

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (key) =>
                    key.name.toLowerCase().includes(query) ||
                    key.description?.toLowerCase().includes(query),
            );
        }

        return filtered;
    });

    // Debounced filter for search
    useDebouncedFilter(
        () => searchQuery,
        () => {}, // No need to reload, filtering is client-side
        SEARCH_DEBOUNCE_MS,
    );

    // Data loading
    async function loadSecurityKeys(reset = false) {
        if (isLoading && !reset) return;

        isLoading = true;
        if (reset) securityKeys = [];

        await withErrorHandling(() => CredentialsService.getSecurityKeys(), {
            errorMessage: "Failed to load security keys",
            onSuccess: (result) => {
                securityKeys = result;
            },
        });

        isLoading = false;
    }

    // CRUD operations
    async function handleKeySubmit(data: any) {
        const submissionData = {
            name: data.name,
            description: data.description || "",
            private_key: data.private_key,
            public_key: data.public_key,
            is_active: data.is_active === undefined ? true : !!data.is_active,
        };

        if (modals.selectedItem) {
            await withErrorHandling(
                () =>
                    CredentialsService.updateSecurityKey(
                        modals.selectedItem!.id,
                        submissionData,
                    ),
                {
                    successMessage: "Security key updated successfully",
                    errorMessage: "Failed to update security key",
                    onSuccess: async () => {
                        showDialog = false;
                        modals.closeAll();
                        await loadSecurityKeys(true);
                    },
                    retry: { maxAttempts: 3 },
                },
            );
        } else {
            await withErrorHandling(
                () => CredentialsService.createSecurityKey(submissionData),
                {
                    successMessage: "Security key created successfully",
                    errorMessage: "Failed to create security key",
                    onSuccess: async () => {
                        showDialog = false;
                        await loadSecurityKeys(true);
                    },
                    retry: { maxAttempts: 3 },
                },
            );
        }
    }

    async function handleDelete() {
        if (!modals.itemToDelete) {
            console.error("[Delete] No security key to delete!");
            return;
        }

        // Capture the ID immediately to avoid race conditions with modal closing
        const keyId = modals.itemToDelete.id;

        await withErrorHandling(
            () => CredentialsService.deleteSecurityKey(keyId),
            {
                successMessage: "Security key deleted successfully",
                errorMessage: "Failed to delete security key",
                onSuccess: async () => {
                    modals.closeAll();
                    await loadSecurityKeys(true);
                },
            },
        );
    }

    function handleEdit(key: SecurityKey) {
        modals.openEdit(key);
        showDialog = true;
    }

    function handleCreate() {
        modals.closeAll();
        showDialog = true;
    }

    function togglePrivateKeyVisibility(id: string) {
        showingPrivateKey[id] = !showingPrivateKey[id];
    }

    async function copyToClipboard(text: string, type: string) {
        try {
            await navigator.clipboard.writeText(text);
            toast.success(`${type} copied to clipboard`);
        } catch (error) {
            toast.error(`Could not copy ${type}`);
        }
    }

    // Auto-show private keys if debug enabled
    $effect(() => {
        if (alwaysShowPrivate) {
            // Use untrack to prevent securityKeys from creating a dependency
            const keys = untrack(() => securityKeys);
            const newVisibility: Record<string, boolean> = {};
            keys.forEach((key) => {
                newVisibility[key.id] = true;
            });
            showingPrivateKey = newVisibility;
        } else {
            // Reset when disabled
            showingPrivateKey = {};
        }
    });

    // Debug panel integration
    onMount(() => {
        loadSecurityKeys(true);

        // Sync listener hook - eliminates manual event management
        const cleanupSync = useSyncListener({
            eventName: "security-keys-synced",
            onSync: () => loadSecurityKeys(true),
            debug: true,
        });

        const cleanupDebug = createPageDebug(
            "security-keys-page",
            "Security Keys Debug",
        )
            .addSwitch(
                "show-inactive",
                "Show Inactive Keys",
                showInactive,
                (value: boolean) => {
                    showInactive = value;
                    debugSettings.update("showInactive", value);
                },
                "Display inactive security keys",
            )
            .addSwitch(
                "show-private",
                "Always Show Private Keys",
                alwaysShowPrivate,
                (value: boolean) => {
                    alwaysShowPrivate = value;
                    debugSettings.update("alwaysShowPrivate", value);
                },
                "Automatically show all private keys (DEBUG ONLY)",
            )
            .addSwitch(
                "auto-refresh",
                "Auto Refresh (30s)",
                autoRefresh.enabled,
                (value: boolean) => {
                    autoRefresh.setEnabled(value);
                    debugSettings.update("autoRefresh", value);
                },
                "Automatically refresh keys every 30 seconds",
            )
            .addButton("force-refresh", "Force Refresh", () => {
                loadSecurityKeys(true);
                toast.success("Security keys refreshed (debug)");
            })
            .addButton("hide-all", "Hide All Private Keys", () => {
                showingPrivateKey = {};
                toast.success("All private keys hidden");
            })
            .addButton("force-sync", "Force Sync Now", () => {
                SecurityKeysSyncService.forceSyncNow();
            })
            .register({ ButtonControl, SwitchControl, SelectControl: null });

        return () => {
            cleanupDebug();
            cleanupSync();
        };
    });
</script>

<div class="p-6">
    <div class="mb-6 flex items-center justify-between">
        <h2 class="text-3xl font-bold">Security Keys</h2>
        <div class="flex space-x-2">
            <Button
                variant="outline"
                on:click={() => loadSecurityKeys(true)}
                disabled={isLoading}
            >
                <RefreshCcw
                    class="mr-2 h-4 w-4 {isLoading ? 'animate-spin' : ''}"
                />
                Refresh
            </Button>
            <Button on:click={handleCreate}>
                <Plus class="mr-2 h-4 w-4" />
                New Key
            </Button>
        </div>
    </div>

    <!-- Usage Charts -->
    <div class="mb-6">
        <CredentialUsageCharts credentialType="security_key" days={30} />
    </div>

    <div class="mb-6">
        <SearchInput
            bind:value={searchQuery}
            placeholder="Search security keys by name or description..."
        />
    </div>

    {#if isLoading}
        <LoadingSpinner size="lg" centered label="Loading security keys..." />
    {:else if filteredKeys.length === 0}
        <EmptyState
            icon={KeyRound}
            title="No security keys found"
            description={showInactive
                ? "No security keys available"
                : "No active security keys found. Create your first key to get started."}
            actionLabel="Add Your First Key"
            onaction={handleCreate}
        />
    {:else}
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {#each filteredKeys as key (key.id)}
                <Card.Root class="h-full">
                    <Card.Header>
                        <div class="flex items-center justify-between">
                            <Card.Title>{key.name}</Card.Title>
                            <Badge
                                variant={key.is_active ? "default" : "destructive"}
                                class="ml-2"
                            >
                                {key.is_active ? "Active" : "Inactive"}
                            </Badge>
                        </div>
                        <Card.Description>
                            {key.description || "No description"}
                        </Card.Description>
                    </Card.Header>
                    <Card.Content>
                        <div class="space-y-2">
                            <div>
                                <p class="text-sm font-medium">Public Key</p>
                                <div class="flex items-center mt-1">
                                    <p class="text-sm font-mono truncate flex-1">
                                        {key.public_key.substring(0, 40)}...
                                    </p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        on:click={() =>
                                            copyToClipboard(
                                                key.public_key,
                                                "Public key",
                                            )}
                                    >
                                        <Copy class="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div>
                                <p class="text-sm font-medium">Private Key</p>
                                <div class="flex items-center mt-1">
                                    <p class="text-sm font-mono truncate flex-1">
                                        {showingPrivateKey[key.id]
                                            ? key.private_key.substring(0, 40) + "..."
                                            : "••••••••••••••••"}
                                    </p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        on:click={() =>
                                            togglePrivateKeyVisibility(key.id)}
                                    >
                                        {#if showingPrivateKey[key.id]}
                                            <EyeOff class="h-4 w-4" />
                                        {:else}
                                            <Eye class="h-4 w-4" />
                                        {/if}
                                    </Button>
                                    {#if showingPrivateKey[key.id]}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            on:click={() =>
                                                copyToClipboard(
                                                    key.private_key,
                                                    "Private key",
                                                )}
                                        >
                                            <Copy class="h-4 w-4" />
                                        </Button>
                                    {/if}
                                </div>
                            </div>
                            <div>
                                <p class="text-sm font-medium">Created</p>
                                <p class="text-sm text-muted-foreground">
                                    {DateUtil.formatRelative(key.created)}
                                </p>
                            </div>
                        </div>
                    </Card.Content>
                    <Card.Footer class="flex justify-between">
                        <div class="space-x-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                on:click={() => {
                                    showStatsFor = key.id;
                                    statsDialogOpen = true;
                                }}
                                title="View usage statistics"
                            >
                                <BarChart3 class="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                on:click={() => handleEdit(key)}
                            >
                                <Pencil class="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                on:click={() => modals.openDelete(key)}
                            >
                                <Trash2 class="h-4 w-4" />
                            </Button>
                        </div>
                    </Card.Footer>
                </Card.Root>
            {/each}
        </div>
    {/if}

    <SecurityKeyDialog
        bind:open={showDialog}
        key={modals.selectedItem}
        on:close={() => {
            showDialog = false;
            modals.closeAll();
        }}
        on:submit={(e: CustomEvent) => handleKeySubmit(e.detail)}
    />

    <!-- Delete Confirmation -->
    <ConfirmDialog
        bind:open={modals.deleteModalOpen}
        title="Delete this security key?"
        description="This action cannot be undone. This will permanently delete your security key and remove it from our servers."
        confirmText="Delete"
        variant="destructive"
        onconfirm={handleDelete}
    />

    <!-- Usage Stats Dialog -->
    {#if showStatsFor}
        {@const selectedKey = securityKeys.find(k => k.id === showStatsFor)}
        <Dialog.Root bind:open={statsDialogOpen} onOpenChange={(open) => { 
            if (!open) {
                showStatsFor = null;
            }
        }}>
            <Dialog.Content class="max-w-2xl">
                <Dialog.Header>
                    <Dialog.Title>Usage Statistics - {selectedKey?.name || 'Security Key'}</Dialog.Title>
                    <Dialog.Description>
                        View detailed usage statistics for this security key
                    </Dialog.Description>
                </Dialog.Header>
                <div class="py-4">
                    <UsageStatsCard 
                        credentialType="security_key" 
                        credentialId={showStatsFor} 
                        showDetails={true}
                    />
                </div>
            </Dialog.Content>
        </Dialog.Root>
    {/if}
</div>


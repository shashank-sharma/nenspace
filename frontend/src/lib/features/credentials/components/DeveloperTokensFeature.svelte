<script lang="ts">
    import { onMount } from "svelte";
    import { Plus, RefreshCcw, KeySquare } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
    import SearchInput from "$lib/components/SearchInput.svelte";
    import type { DeveloperToken } from "$lib/features/credentials/types";
    import { DeveloperTokenCard } from "$lib/features/credentials/components";
    import DeveloperTokenDialog from "./DeveloperTokenDialog.svelte";
    import {
        CredentialsService,
        DeveloperTokensSyncService,
    } from "../services";
    import { withErrorHandling } from "$lib/utils";
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

    // State
    let tokens = $state<DeveloperToken[]>([]);
    let isLoading = $state(true);
    let searchQuery = $state("");

    // Modal management using hook
    const modals = useModalState<DeveloperToken>();
    let showDialog = $state(false);

    // Debug settings
    const debugSettings = new DebugSettings("dev-tokens-debug", {
        showInactive: false,
        autoRefresh: false,
    });

    let showInactive = $state(debugSettings.get("showInactive"));

    // Auto-refresh hook - eliminates manual interval management
    const autoRefresh = useAutoRefresh({
        refreshFn: () => loadTokens(true),
        intervalMs: 30000,
        initialEnabled: debugSettings.get("autoRefresh"),
    });

    // Filtered tokens based on search and debug settings
    let filteredTokens = $derived.by(() => {
        let filtered = showInactive
            ? tokens
            : tokens.filter((token) => token.is_active);

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (token) =>
                    token.name.toLowerCase().includes(query) ||
                    token.environment.toLowerCase().includes(query),
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
    async function loadTokens(reset = false) {
        if (isLoading && !reset) return;

        isLoading = true;
        if (reset) tokens = [];

        await withErrorHandling(() => CredentialsService.getDeveloperTokens(), {
            errorMessage: "Failed to load developer tokens",
            onSuccess: (result) => {
                tokens = result;
            },
        });

        isLoading = false;
    }

    // CRUD operations
    async function handleSubmit(data: Partial<DeveloperToken>) {
        if (modals.selectedItem) {
            // Update existing
            await withErrorHandling(
                () =>
                    CredentialsService.updateDeveloperToken(
                        modals.selectedItem!.id,
                        data,
                    ),
                {
                    successMessage: "Developer token updated successfully",
                    errorMessage: "Failed to update developer token",
                    onSuccess: async () => {
                        showDialog = false;
                        modals.closeAll();
                        await loadTokens(true);
                    },
                },
            );
        } else {
            // Create new
            await withErrorHandling(
                () => CredentialsService.createDeveloperToken(data),
                {
                    successMessage: "Developer token created successfully",
                    errorMessage: "Failed to create developer token",
                    onSuccess: async () => {
                        showDialog = false;
                        await loadTokens(true);
                    },
                },
            );
        }
    }

    async function handleDelete() {
        if (!modals.itemToDelete) {
            console.error("[Delete] No item to delete!");
            return;
        }

        // Capture the ID immediately to avoid race conditions with modal closing
        const tokenId = modals.itemToDelete.id;
        const tokenName = modals.itemToDelete.name;

        console.log("[Delete] Deleting token:", { tokenId, tokenName });

        await withErrorHandling(
            () => CredentialsService.deleteDeveloperToken(tokenId),
            {
                successMessage: "Developer token deleted successfully",
                errorMessage: "Failed to delete developer token",
                onSuccess: async () => {
                    modals.closeAll();
                    await loadTokens(true);
                },
            },
        );
    }

    async function handleToggleStatus(id: string, currentStatus: boolean) {
        await withErrorHandling(
            () =>
                CredentialsService.toggleDeveloperTokenStatus(
                    id,
                    currentStatus,
                ),
            {
                successMessage: "Developer token status updated",
                errorMessage: "Failed to update developer token status",
                onSuccess: async () => {
                    await loadTokens(true);
                },
            },
        );
    }

    function handleEdit(token: DeveloperToken) {
        modals.openEdit(token);
        showDialog = true;
    }

    function handleCreate() {
        modals.closeAll();
        showDialog = true;
    }

    // Debug panel integration
    onMount(() => {
        loadTokens(true);

        // Sync listener hook - eliminates manual event management
        const cleanupSync = useSyncListener({
            eventName: "developer-tokens-synced",
            onSync: () => loadTokens(true),
            debug: true,
        });

        const cleanupDebug = createPageDebug(
            "dev-tokens-page",
            "Developer Tokens Debug",
        )
            .addSwitch(
                "show-inactive",
                "Show Inactive Tokens",
                showInactive,
                (value: boolean) => {
                    showInactive = value;
                    debugSettings.update("showInactive", value);
                },
                "Display inactive developer tokens",
            )
            .addSwitch(
                "auto-refresh",
                "Auto Refresh (30s)",
                autoRefresh.enabled,
                (value: boolean) => {
                    autoRefresh.setEnabled(value);
                    debugSettings.update("autoRefresh", value);
                },
                "Automatically refresh tokens every 30 seconds",
            )
            .addButton("force-refresh", "Force Refresh", () => {
                loadTokens(true);
            })
            .addButton("force-sync", "Force Sync Now", () => {
                DeveloperTokensSyncService.forceSyncNow();
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
        <h2 class="text-3xl font-bold">Developer Tokens</h2>
        <div class="flex space-x-2">
            <Button
                variant="outline"
                onclick={() => loadTokens(true)}
                disabled={isLoading}
            >
                <RefreshCcw
                    class="mr-2 h-4 w-4 {isLoading ? 'animate-spin' : ''}"
                />
                Refresh
            </Button>
            <Button onclick={handleCreate}>
                <Plus class="mr-2 h-4 w-4" />
                New Token
            </Button>
        </div>
    </div>

    <div class="mb-6">
        <SearchInput
            bind:value={searchQuery}
            placeholder="Search developer tokens by name or environment..."
        />
    </div>

    {#if isLoading}
        <LoadingSpinner
            size="lg"
            centered
            label="Loading developer tokens..."
        />
    {:else if filteredTokens.length === 0}
        <EmptyState
            icon={KeySquare}
            title="No developer tokens found"
            description={showInactive
                ? "No developer tokens available"
                : "No active developer tokens found. Create your first token to get started."}
            actionLabel="Create Token"
            onaction={handleCreate}
        />
    {:else}
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {#each filteredTokens as token (token.id)}
                <DeveloperTokenCard
                    {token}
                    onedit={() => handleEdit(token)}
                    ondelete={() => modals.openDelete(token)}
                    ontoggleStatus={() =>
                        handleToggleStatus(token.id, token.is_active)}
                />
            {/each}
        </div>
    {/if}
</div>

<!-- Create/Edit Dialog -->
<DeveloperTokenDialog
    bind:open={showDialog}
    token={modals.selectedItem}
    onsubmit={handleSubmit}
    onclose={() => {
        showDialog = false;
        modals.closeAll();
    }}
/>

<!-- Delete Confirmation -->
<ConfirmDialog
    bind:open={modals.deleteModalOpen}
    title="Delete this developer token?"
    description="This action cannot be undone. This will permanently delete the developer token."
    confirmText="Delete"
    variant="destructive"
    onconfirm={handleDelete}
/>

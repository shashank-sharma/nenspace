<script lang="ts">
    import { onMount } from "svelte";
    import { Plus, RefreshCcw, Key } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
    import SearchInput from "$lib/components/SearchInput.svelte";
    import type { ApiKey } from "$lib/features/credentials/types";
    import { ApiKeyCard } from "$lib/features/credentials/components";
    import ApiKeyDialog from "./ApiKeyDialog.svelte";
    import { CredentialsService, ApiKeysSyncService } from "../services";
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
    import CredentialUsageCharts from "./CredentialUsageCharts.svelte";

    // State
    let apiKeys = $state<ApiKey[]>([]);
    let isLoading = $state(true);
    let searchQuery = $state("");

    // Modal management using hook
    const modals = useModalState<ApiKey>();
    let showDialog = $state(false);

    // Debug settings
    const debugSettings = new DebugSettings("api-keys-debug", {
        showInactive: false,
        autoRefresh: false,
    });

    let showInactive = $state(debugSettings.get("showInactive"));

    // Auto-refresh hook - eliminates manual interval management
    const autoRefresh = useAutoRefresh({
        refreshFn: () => loadApiKeys(true),
        intervalMs: 30000,
        initialEnabled: debugSettings.get("autoRefresh"),
    });

    // Filtered API keys based on search and debug settings
    let filteredApiKeys = $derived.by(() => {
        let filtered = showInactive
            ? apiKeys
            : apiKeys.filter((key) => key.is_active);

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (key) =>
                    key.name.toLowerCase().includes(query) ||
                    key.description?.toLowerCase().includes(query) ||
                    key.service.toLowerCase().includes(query),
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
    async function loadApiKeys(reset = false) {
        if (isLoading && !reset) return;

        isLoading = true;
        if (reset) apiKeys = [];

        await withErrorHandling(() => CredentialsService.getApiKeys(), {
            errorMessage: "Failed to load API keys",
            onSuccess: (result) => {
                apiKeys = result;
            },
        });

        isLoading = false;
    }

    // CRUD operations
    async function handleSubmit(data: Partial<ApiKey>) {
        if (modals.selectedItem) {
            // Update existing
            await withErrorHandling(
                () =>
                    CredentialsService.updateApiKey(
                        modals.selectedItem!.id,
                        data,
                    ),
                {
                    successMessage: "API key updated successfully",
                    errorMessage: "Failed to update API key",
                    onSuccess: async () => {
                        showDialog = false;
                        modals.closeAll();
                        await loadApiKeys(true);
                    },
                },
            );
        } else {
            // Create new
            await withErrorHandling(
                () => CredentialsService.createApiKey(data),
                {
                    successMessage: "API key created successfully",
                    errorMessage: "Failed to create API key",
                    onSuccess: async () => {
                        showDialog = false;
                        await loadApiKeys(true);
                    },
                },
            );
        }
    }

    async function handleDelete() {
        if (!modals.itemToDelete) {
            console.error("[Delete] No API key to delete!");
            return;
        }

        // Capture the ID immediately to avoid race conditions with modal closing
        const apiKeyId = modals.itemToDelete.id;
        const apiKeyName = modals.itemToDelete.name;

        console.log("[Delete] Deleting API key:", { apiKeyId, apiKeyName });

        await withErrorHandling(
            () => CredentialsService.deleteApiKey(apiKeyId),
            {
                successMessage: "API key deleted successfully",
                errorMessage: "Failed to delete API key",
                onSuccess: async () => {
                    modals.closeAll();
                    await loadApiKeys(true);
                },
            },
        );
    }

    async function handleToggleStatus(id: string, currentStatus: boolean) {
        await withErrorHandling(
            () => CredentialsService.toggleApiKeyStatus(id, currentStatus),
            {
                successMessage: "API key status updated",
                errorMessage: "Failed to update API key status",
                onSuccess: async () => {
                    await loadApiKeys(true);
                },
            },
        );
    }

    function handleEdit(apiKey: ApiKey) {
        modals.openEdit(apiKey);
        showDialog = true;
    }

    function handleCreate() {
        modals.closeAll();
        showDialog = true;
    }

    // Debug panel integration
    onMount(() => {
        loadApiKeys(true);

        // Sync listener hook - eliminates manual event management
        const cleanupSync = useSyncListener({
            eventName: "api-keys-synced",
            onSync: () => loadApiKeys(true),
            debug: true,
        });

        const cleanupDebug = createPageDebug("api-keys-page", "API Keys Debug")
            .addSwitch(
                "show-inactive",
                "Show Inactive Keys",
                showInactive,
                (value: boolean) => {
                    showInactive = value;
                    debugSettings.update("showInactive", value);
                },
                "Display inactive API keys",
            )
            .addSwitch(
                "auto-refresh",
                "Auto Refresh (30s)",
                autoRefresh.enabled,
                (value: boolean) => {
                    autoRefresh.setEnabled(value);
                    debugSettings.update("autoRefresh", value);
                },
                "Automatically refresh API keys every 30 seconds",
            )
            .addButton("force-refresh", "Force Refresh", () => {
                loadApiKeys(true);
            })
            .addButton("force-sync", "Force Sync Now", () => {
                ApiKeysSyncService.forceSyncNow();
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
        <h2 class="text-3xl font-bold">API Keys</h2>
        <div class="flex space-x-2">
            <Button
                variant="outline"
                onclick={() => loadApiKeys(true)}
                disabled={isLoading}
            >
                <RefreshCcw
                    class="mr-2 h-4 w-4 {isLoading ? 'animate-spin' : ''}"
                />
                Refresh
            </Button>
            <Button onclick={handleCreate}>
                <Plus class="mr-2 h-4 w-4" />
                New API Key
            </Button>
        </div>
    </div>

    <!-- Usage Charts -->
    <div class="mb-6">
        <CredentialUsageCharts credentialType="api_key" days={30} />
    </div>

    <div class="mb-6">
        <SearchInput
            bind:value={searchQuery}
            placeholder="Search API keys by name, description, or service..."
        />
    </div>

    {#if isLoading}
        <LoadingSpinner size="lg" centered label="Loading API keys..." />
    {:else if filteredApiKeys.length === 0}
        <EmptyState
            icon={Key}
            title="No API keys found"
            description={showInactive
                ? "No API keys available"
                : "No active API keys found. Create your first key to get started."}
            actionLabel="Create API Key"
            onaction={handleCreate}
        />
    {:else}
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {#each filteredApiKeys as apiKey (apiKey.id)}
                <ApiKeyCard
                    {apiKey}
                    onedit={() => handleEdit(apiKey)}
                    ondelete={() => modals.openDelete(apiKey)}
                    ontoggleStatus={() =>
                        handleToggleStatus(apiKey.id, apiKey.is_active)}
                />
            {/each}
        </div>
    {/if}
</div>

<!-- Create/Edit Dialog -->
<ApiKeyDialog
    bind:open={showDialog}
    apiKey={modals.selectedItem}
    onsubmit={handleSubmit}
    onclose={() => {
        showDialog = false;
        modals.closeAll();
    }}
/>

<!-- Delete Confirmation -->
<ConfirmDialog
    bind:open={modals.deleteModalOpen}
    title="Delete this API key?"
    description="This action cannot be undone. This will permanently delete the API key."
    confirmText="Delete"
    variant="destructive"
    onconfirm={handleDelete}
/>

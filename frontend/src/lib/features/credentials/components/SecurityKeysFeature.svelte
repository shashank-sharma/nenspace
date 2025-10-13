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
    } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import {
        Card,
        CardContent,
        CardDescription,
        CardFooter,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
    import SecurityKeyDialog from "./SecurityKeyDialog.svelte";
    import type { SecurityKey } from "$lib/features/credentials/types";
    import { CredentialsService, SecurityKeysSyncService } from "../services";
    import { withErrorHandling, DateUtil } from "$lib/utils";
    import { useModalState, useAutoRefresh, useSyncListener } from "$lib/hooks";
    import { createPageDebug, DebugSettings } from "$lib/utils/debug-helper";
    import ButtonControl from "$lib/components/debug/controls/ButtonControl.svelte";
    import SwitchControl from "$lib/components/debug/controls/SwitchControl.svelte";
    import { toast } from "svelte-sonner";

    // State
    let securityKeys = $state<SecurityKey[]>([]);
    let isLoading = $state(true);
    let showingPrivateKey = $state<Record<string, boolean>>({});

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

    // Filtered security keys based on debug settings
    let filteredKeys = $derived(
        showInactive
            ? securityKeys
            : securityKeys.filter((key) => key.is_active),
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
        const is_active = key.is_active === undefined ? true : !!key.is_active;
        modals.openEdit({ ...key, is_active });
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

<div class="container mx-auto px-2 sm:px-4">
    <div
        class="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
    >
        <h2 class="text-2xl font-bold sm:text-3xl">Security Keys</h2>
        <div class="flex w-full gap-2 sm:w-auto">
            <Button
                variant="outline"
                class="flex-1 sm:flex-initial"
                onclick={() => loadSecurityKeys(true)}
                disabled={isLoading}
            >
                <RefreshCcw
                    class="mr-2 h-4 w-4 {isLoading ? 'animate-spin' : ''}"
                />
                Refresh
            </Button>
            <Button
                class="flex-1 sm:flex-initial"
                onclick={() => {
                    modals.closeAll();
                    showDialog = true;
                }}
            >
                <Plus class="mr-2 h-4 w-4" />
                New Key
            </Button>
        </div>
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
            onaction={() => {
                modals.closeAll();
                showDialog = true;
            }}
        />
    {:else}
        <div
            class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
            {#each filteredKeys as key (key.id)}
                <Card
                    class="h-full overflow-hidden border-opacity-50 transition-all hover:border-opacity-100"
                >
                    <CardHeader class="px-3 py-2">
                        <div class="flex flex-col gap-1">
                            <div class="flex items-center justify-between">
                                <div class="overflow-hidden">
                                    <CardTitle
                                        class="flex items-center gap-1 truncate text-sm"
                                    >
                                        <KeyRound
                                            class="h-3.5 w-3.5 flex-shrink-0"
                                        />
                                        <span class="truncate">{key.name}</span>
                                    </CardTitle>
                                </div>
                                {#if key.is_active}
                                    <Badge
                                        variant="outline"
                                        class="flex shrink-0 items-center gap-1 border-green-200 bg-green-50 px-1.5 py-0 text-[10px] font-normal text-green-700"
                                    >
                                        <div
                                            class="h-1.5 w-1.5 rounded-full bg-green-500"
                                        ></div>
                                        Active
                                    </Badge>
                                {:else}
                                    <Badge
                                        variant="outline"
                                        class="flex shrink-0 items-center gap-1 border-gray-200 bg-gray-50 px-1.5 py-0 text-[10px] font-normal text-gray-500"
                                    >
                                        <div
                                            class="h-1.5 w-1.5 rounded-full bg-gray-400"
                                        ></div>
                                        Inactive
                                    </Badge>
                                {/if}
                            </div>
                            <CardDescription class="line-clamp-1 text-xs">
                                {key.description || "No description"}
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent class="px-3 py-1">
                        <div class="space-y-1">
                            <div>
                                <h4
                                    class="mb-1 flex items-center gap-1 text-xs font-medium"
                                >
                                    <span>Public Key</span>
                                </h4>
                                <div class="relative">
                                    <pre
                                        class="max-h-[40px] overflow-x-auto rounded-md bg-muted p-1.5 text-[10px]">{key.public_key}</pre>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        class="action-button absolute right-0.5 top-0.5 h-5 w-5"
                                        title="Copy public key"
                                        onclick={() =>
                                            copyToClipboard(
                                                key.public_key,
                                                "Public key",
                                            )}
                                    >
                                        <Copy class="h-2.5 w-2.5" />
                                    </Button>
                                </div>
                            </div>
                            <div>
                                <div
                                    class="mb-1 flex items-center justify-between"
                                >
                                    <h4
                                        class="flex items-center gap-1 text-xs font-medium"
                                    >
                                        <span>Private Key</span>
                                    </h4>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        class="action-button h-5 px-1"
                                        onclick={() =>
                                            togglePrivateKeyVisibility(key.id)}
                                    >
                                        {#if showingPrivateKey[key.id]}
                                            <EyeOff class="h-2.5 w-2.5" />
                                        {:else}
                                            <Eye class="h-2.5 w-2.5" />
                                        {/if}
                                    </Button>
                                </div>
                                {#if showingPrivateKey[key.id]}
                                    <div class="relative">
                                        <pre
                                            class="max-h-[70px] overflow-x-auto rounded-md bg-muted p-1.5 text-[10px]">{key.private_key}</pre>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            class="action-button absolute right-0.5 top-0.5 h-5 w-5"
                                            title="Copy private key"
                                            onclick={() =>
                                                copyToClipboard(
                                                    key.private_key,
                                                    "Private key",
                                                )}
                                        >
                                            <Copy class="h-2.5 w-2.5" />
                                        </Button>
                                    </div>
                                {:else}
                                    <div
                                        class="flex h-6 items-center justify-center rounded-md bg-muted p-1.5 text-[10px]"
                                    >
                                        <span
                                            class="text-[10px] text-muted-foreground"
                                            >Hidden for security</span
                                        >
                                    </div>
                                {/if}
                            </div>
                            <div class="mt-2 text-[10px] text-muted-foreground">
                                Created: {DateUtil.formatRelative(key.created)}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter
                        class="flex justify-end gap-1 border-t border-border/50 p-2"
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            class="action-button h-7 w-7"
                            title="Edit"
                            onclick={() => handleEdit(key)}
                        >
                            <Pencil class="h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            class="action-button h-7 w-7 text-destructive hover:text-destructive"
                            title="Delete"
                            onclick={() => modals.openDelete(key)}
                        >
                            <Trash2 class="h-3 w-3" />
                        </Button>
                    </CardFooter>
                </Card>
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
</div>

<style>
    /* Enhanced mobile styles */
    @media (max-width: 640px) {
        :global(.action-button) {
            transform: scale(1.1);
        }

        :global(pre) {
            font-size: 9px;
        }
    }
</style>

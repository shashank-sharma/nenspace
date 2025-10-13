<script lang="ts">
    import { onMount } from "svelte";
    import { Plus, RefreshCcw, Mail, Calendar, Settings } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
    import type { Token } from "$lib/features/tokens/types";
    import { TokenCard } from "$lib/features/tokens/components";
    import { CalendarService } from "$lib/features/calendar/services";
    import { MailService } from "$lib/features/mail/services";
    import { CredentialsService } from "../services";
    import { DEFAULT_TOKEN_FORM, type CredentialsState } from "../types";
    import { AUTH_POPUP_WIDTH, AUTH_POPUP_HEIGHT } from "../constants";
    import {
        withErrorHandling,
        validateWithToast,
        required,
        minLength,
    } from "$lib/utils";
    import { useModalState } from "$lib/hooks";
    import { createPageDebug, DebugSettings } from "$lib/utils/debug-helper";
    import ButtonControl from "$lib/components/debug/controls/ButtonControl.svelte";
    import SwitchControl from "$lib/components/debug/controls/SwitchControl.svelte";
    import { toast } from "svelte-sonner";

    // State
    let tokens = $state<Token[]>([]);
    let isLoading = $state(true);
    let authWindow: Window | null = null;

    // Modal management using hook
    const modals = useModalState<Token>();
    let showIntegrationsDialog = $state(false);

    // Form state
    let customTokenForm = $state({ ...DEFAULT_TOKEN_FORM });

    // Debug settings
    const debugSettings = new DebugSettings("tokens-debug", {
        showAllTokens: false,
        autoRefresh: false,
    });

    let showAllTokens = $state(debugSettings.get("showAllTokens"));
    let autoRefresh = $state(debugSettings.get("autoRefresh"));

    // Data loading
    async function loadTokens(reset = false) {
        if (isLoading && !reset) return;

        isLoading = true;
        if (reset) tokens = [];

        await withErrorHandling(() => CredentialsService.getTokens(), {
            errorMessage: "Failed to load tokens",
            onSuccess: (result) => {
                tokens = result;
            },
        });

        isLoading = false;
    }

    // CRUD operations
    async function handleCreateToken() {
        if (
            !validateWithToast(customTokenForm, {
                provider: [required("Provider is required")],
                account: [
                    required("Account is required"),
                    minLength(3, "Account must be at least 3 characters"),
                ],
                access_token: [
                    required("Access token is required"),
                    minLength(10, "Token is too short"),
                ],
                token_type: [required("Token type is required")],
            })
        ) {
            return;
        }

        await withErrorHandling(
            () => CredentialsService.createToken(customTokenForm),
            {
                successMessage: "Token created successfully",
                errorMessage: "Failed to create token",
                onSuccess: async () => {
                    modals.closeAll();
                    customTokenForm = { ...DEFAULT_TOKEN_FORM };
                    await loadTokens(true);
                },
                retry: { maxAttempts: 3 },
            },
        );
    }

    async function handleUpdateToken() {
        if (!modals.selectedItem) return;

        if (
            !validateWithToast(customTokenForm, {
                provider: [required("Provider is required")],
                account: [required("Account is required")],
                access_token: [required("Access token is required")],
            })
        ) {
            return;
        }

        await withErrorHandling(
            () =>
                CredentialsService.updateToken(
                    modals.selectedItem!.id,
                    customTokenForm,
                ),
            {
                successMessage: "Token updated successfully",
                errorMessage: "Failed to update token",
                onSuccess: async () => {
                    modals.closeAll();
                    customTokenForm = { ...DEFAULT_TOKEN_FORM };
                    await loadTokens(true);
                },
                retry: { maxAttempts: 3 },
            },
        );
    }

    async function handleDelete() {
        if (!modals.itemToDelete) {
            console.error("[Delete] No token to delete!");
            return;
        }

        // Capture the ID immediately to avoid race conditions with modal closing
        const tokenId = modals.itemToDelete.id;
        const tokenProvider = modals.itemToDelete.provider;

        console.log("[Delete] Deleting OAuth token:", {
            tokenId,
            tokenProvider,
        });

        await withErrorHandling(() => CredentialsService.deleteToken(tokenId), {
            successMessage: "Token deleted successfully",
            errorMessage: "Failed to delete token",
            onSuccess: async () => {
                modals.closeAll();
                await loadTokens(true);
            },
        });
    }

    async function handleToggleStatus(id: string, currentStatus: boolean) {
        await withErrorHandling(
            () => CredentialsService.toggleTokenStatus(id, currentStatus),
            {
                successMessage: "Token status updated",
                errorMessage: "Failed to update token status",
                onSuccess: async () => {
                    await loadTokens(true);
                },
            },
        );
    }

    // Auth handling
    async function handleAuth(
        authService: () => Promise<string | null>,
        serviceName: string,
    ) {
        try {
            const authUrl = await authService();
            if (authUrl) {
                authWindow = window.open(
                    authUrl,
                    "auth",
                    `width=${AUTH_POPUP_WIDTH},height=${AUTH_POPUP_HEIGHT}`,
                );
                if (!authWindow) {
                    toast.error(
                        "Popup window was blocked. Please allow popups for this site.",
                    );
                } else {
                    showIntegrationsDialog = false;
                }
            } else {
                toast.error(`Failed to get ${serviceName} authentication URL`);
            }
        } catch (error) {
            toast.error(`Failed to start ${serviceName} authentication`);
        }
    }

    // Edit handler
    function handleEdit(token: Token) {
        modals.openEdit(token);
        customTokenForm = {
            provider: token.provider,
            account: token.account,
            access_token: token.access_token,
            token_type: token.token_type,
            refresh_token: token.refresh_token || "",
            scope: token.scope || "",
        };
    }

    // Message listener for auth completion
    $effect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data === "AUTH_COMPLETE") {
                toast.success("Authentication complete!");
                authWindow?.close();
                authWindow = null;
                loadTokens(true);
            }
        };

        window.addEventListener("message", handleMessage);

        return () => {
            window.removeEventListener("message", handleMessage);
            authWindow?.close();
        };
    });

    // Reset form when modals close
    $effect(() => {
        if (!modals.editModalOpen && !modals.createModalOpen) {
            customTokenForm = { ...DEFAULT_TOKEN_FORM };
        }
    });

    // Auto-refresh if enabled
    $effect(() => {
        if (autoRefresh) {
            const interval = setInterval(() => loadTokens(true), 30000);
            return () => clearInterval(interval);
        }
    });

    // Debug panel integration
    onMount(() => {
        loadTokens(true);

        const cleanup = createPageDebug("tokens-page", "Tokens Debug")
            .addSwitch(
                "show-all",
                "Show All Tokens",
                showAllTokens,
                (value: boolean) => {
                    showAllTokens = value;
                    debugSettings.update("showAllTokens", value);
                },
                "Display tokens without filtering",
            )
            .addSwitch(
                "auto-refresh",
                "Auto Refresh (30s)",
                autoRefresh,
                (value: boolean) => {
                    autoRefresh = value;
                    debugSettings.update("autoRefresh", value);
                },
                "Automatically refresh tokens every 30 seconds",
            )
            .addButton("force-refresh", "Force Refresh", () => {
                loadTokens(true);
                toast.success("Tokens refreshed (debug)");
            })
            .addButton("clear-cache", "Clear Cache", () => {
                tokens = [];
                toast.success("Tokens cache cleared (debug)");
            })
            .register({ ButtonControl, SwitchControl, SelectControl: null });

        return cleanup;
    });
</script>

<div class="p-6">
    <div class="mb-6 flex items-center justify-between">
        <h2 class="text-3xl font-bold">API Tokens</h2>
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
            <Button onclick={() => (showIntegrationsDialog = true)}>
                <Plus class="mr-2 h-4 w-4" />
                New Token
            </Button>
        </div>
    </div>

    {#if isLoading}
        <LoadingSpinner size="lg" centered label="Loading tokens..." />
    {:else if tokens.length === 0}
        <EmptyState
            icon={Settings}
            title="No API tokens found"
            description="Connect an integration or create a custom token to get started"
            actionLabel="Add Token"
            onaction={() => (showIntegrationsDialog = true)}
        />
    {:else}
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {#each tokens as token (token.id)}
                <TokenCard
                    {token}
                    on:edit={(e) => handleEdit(e.detail)}
                    on:delete={(e) => {
                        // TokenCard dispatches just the ID (string), not the full object
                        const tokenId = e.detail as string;
                        const token = tokens.find((t) => t.id === tokenId);
                        if (token) {
                            modals.openDelete(token);
                        }
                    }}
                    on:toggleStatus={(e) =>
                        handleToggleStatus(e.detail.id, e.detail.status)}
                />
            {/each}
        </div>
    {/if}
</div>

<!-- Integration Selection Dialog -->
<Dialog.Root bind:open={showIntegrationsDialog}>
    <Dialog.Content class="sm:max-w-[600px]">
        <Dialog.Header>
            <Dialog.Title>Add New Integration</Dialog.Title>
        </Dialog.Header>
        <div class="grid grid-cols-1 gap-4 py-4 md:grid-cols-3">
            <Card
                class="cursor-pointer transition-colors hover:border-primary"
                role="button"
                tabindex="0"
                onkeydown={(e) =>
                    e.key === "Enter" &&
                    handleAuth(MailService.startAuth, "email")}
                onclick={() => handleAuth(MailService.startAuth, "email")}
            >
                <CardHeader class="pb-2">
                    <CardTitle class="flex items-center text-lg">
                        <Mail class="mr-2 h-5 w-5" />Email
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p class="text-sm text-muted-foreground">
                        Connect your email account
                    </p>
                </CardContent>
            </Card>
            <Card
                class="cursor-pointer transition-colors hover:border-primary"
                role="button"
                tabindex="0"
                onkeydown={(e) =>
                    e.key === "Enter" &&
                    handleAuth(CalendarService.startAuth, "calendar")}
                onclick={() =>
                    handleAuth(CalendarService.startAuth, "calendar")}
            >
                <CardHeader class="pb-2">
                    <CardTitle class="flex items-center text-lg">
                        <Calendar class="mr-2 h-5 w-5" />Calendar
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p class="text-sm text-muted-foreground">
                        Connect Google Calendar
                    </p>
                </CardContent>
            </Card>
            <Card
                class="cursor-pointer transition-colors hover:border-primary"
                role="button"
                tabindex="0"
                onkeydown={(e) => {
                    if (e.key === "Enter") {
                        showIntegrationsDialog = false;
                        setTimeout(() => modals.openCreate(), 150);
                    }
                }}
                onclick={() => {
                    showIntegrationsDialog = false;
                    setTimeout(() => modals.openCreate(), 150);
                }}
            >
                <CardHeader class="pb-2">
                    <CardTitle class="flex items-center text-lg">
                        <Settings class="mr-2 h-5 w-5" />Custom
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p class="text-sm text-muted-foreground">
                        Add a custom API token
                    </p>
                </CardContent>
            </Card>
        </div>
    </Dialog.Content>
</Dialog.Root>

<!-- Custom Token Dialog -->
<Dialog.Root bind:open={modals.createModalOpen}>
    <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
            <Dialog.Title>Create Custom Token</Dialog.Title>
        </Dialog.Header>
        <form
            class="space-y-4"
            onsubmit={(e) => {
                e.preventDefault();
                handleCreateToken();
            }}
        >
            <div class="space-y-2">
                <Label for="provider">Provider *</Label>
                <Input
                    id="provider"
                    bind:value={customTokenForm.provider}
                    placeholder="e.g., GitHub, AWS, etc."
                />
            </div>
            <div class="space-y-2">
                <Label for="account">Account *</Label>
                <Input
                    id="account"
                    bind:value={customTokenForm.account}
                    placeholder="Account identifier"
                />
            </div>
            <div class="space-y-2">
                <Label for="access_token">Access Token *</Label>
                <Input
                    id="access_token"
                    type="password"
                    bind:value={customTokenForm.access_token}
                    placeholder="Enter access token"
                />
            </div>
            <div class="space-y-2">
                <Label for="token_type">Token Type</Label>
                <Input
                    id="token_type"
                    bind:value={customTokenForm.token_type}
                    placeholder="Bearer"
                />
            </div>
            <div class="space-y-2">
                <Label for="refresh_token">Refresh Token (Optional)</Label>
                <Input
                    id="refresh_token"
                    type="password"
                    bind:value={customTokenForm.refresh_token}
                    placeholder="Enter refresh token"
                />
            </div>
            <div class="space-y-2">
                <Label for="scope">Scope (Optional)</Label>
                <Input
                    id="scope"
                    bind:value={customTokenForm.scope}
                    placeholder="e.g., read write"
                />
            </div>
            <Dialog.Footer>
                <Button
                    type="button"
                    variant="outline"
                    onclick={() => modals.closeAll()}>Cancel</Button
                >
                <Button type="submit">Create Token</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<!-- Edit Token Dialog -->
<Dialog.Root bind:open={modals.editModalOpen}>
    <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
            <Dialog.Title>Edit Token</Dialog.Title>
        </Dialog.Header>
        <form
            class="space-y-4"
            onsubmit={(e) => {
                e.preventDefault();
                handleUpdateToken();
            }}
        >
            <div class="space-y-2">
                <Label for="edit-provider">Provider *</Label>
                <Input
                    id="edit-provider"
                    bind:value={customTokenForm.provider}
                    placeholder="Provider"
                />
            </div>
            <div class="space-y-2">
                <Label for="edit-account">Account *</Label>
                <Input
                    id="edit-account"
                    bind:value={customTokenForm.account}
                    placeholder="Account"
                />
            </div>
            <div class="space-y-2">
                <Label for="edit-access_token">Access Token *</Label>
                <Input
                    id="edit-access_token"
                    type="password"
                    bind:value={customTokenForm.access_token}
                    placeholder="Access token"
                />
            </div>
            <div class="space-y-2">
                <Label for="edit-token_type">Token Type</Label>
                <Input
                    id="edit-token_type"
                    bind:value={customTokenForm.token_type}
                />
            </div>
            <div class="space-y-2">
                <Label for="edit-refresh_token">Refresh Token</Label>
                <Input
                    id="edit-refresh_token"
                    type="password"
                    bind:value={customTokenForm.refresh_token}
                />
            </div>
            <div class="space-y-2">
                <Label for="edit-scope">Scope</Label>
                <Input id="edit-scope" bind:value={customTokenForm.scope} />
            </div>
            <Dialog.Footer>
                <Button
                    type="button"
                    variant="outline"
                    onclick={() => modals.closeAll()}>Cancel</Button
                >
                <Button type="submit">Update Token</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<!-- Delete Confirmation -->
<ConfirmDialog
    bind:open={modals.deleteModalOpen}
    title="Delete this token?"
    description="This action cannot be undone. This will permanently delete the token."
    confirmText="Delete"
    variant="destructive"
    onconfirm={handleDelete}
/>

<script lang="ts">
    import { onMount } from "svelte";
    import { pb } from "$lib/config/pocketbase";
    import { toast } from "svelte-sonner";
    import { Plus, RefreshCcw, Mail, Calendar, Settings } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import * as AlertDialog from "$lib/components/ui/alert-dialog";
    import * as Dialog from "$lib/components/ui/dialog";
    import {
        Card,
        CardContent,
        CardDescription,
        CardFooter,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";
    import type { Token } from "$lib/features/tokens/types";
    import { TokenCard } from "$lib/features/tokens/components";
    import { calendarStore } from "$lib/features/calendar/stores/calendar.store";
    import { mailStore } from "$lib/features/mail";

    let tokens: Token[] = [];
    let loading = true;
    let showIntegrationsDialog = false;
    let showCustomTokenDialog = false;
    let showDeleteDialog = false;
    let selectedToken: Token | null = null;
    let tokenToDelete: string | null = null;
    let authWindow: Window | null = null;

    // Custom token form
    let customTokenForm = {
        provider: "",
        account: "",
        access_token: "",
        token_type: "Bearer",
        refresh_token: "",
        scope: "",
    };

    async function loadTokens() {
        loading = true;
        try {
            const records = await pb.collection("tokens").getFullList({
                sort: "-created",
                expand: "user",
            });
            tokens = records as unknown as Token[];
        } catch (error) {
            console.error("Load tokens error:", error);
            toast.error("Failed to load tokens");
        } finally {
            loading = false;
        }
    }

    async function handleCustomTokenSubmit() {
        try {
            console.log("Submitting custom token form", {
                formData: customTokenForm,
                isEdit: !!selectedToken,
            });

            if (
                !customTokenForm.provider ||
                !customTokenForm.account ||
                !customTokenForm.access_token
            ) {
                toast.error("Provider, Account and Access Token are required");
                return;
            }

            if (selectedToken) {
                // Update existing token
                console.log("Updating token", selectedToken.id);
                await pb
                    .collection("tokens")
                    .update(selectedToken.id, customTokenForm);
                toast.success("Token updated successfully");
            } else {
                // Create new token
                console.log("Creating new token");
                const tokenData = {
                    ...customTokenForm,
                    user: pb.authStore.model?.id,
                    is_active: true,
                };
                await pb.collection("tokens").create(tokenData);
                toast.success("Token created successfully");
            }

            showCustomTokenDialog = false;
            // Reset form
            customTokenForm = {
                provider: "",
                account: "",
                access_token: "",
                token_type: "Bearer",
                refresh_token: "",
                scope: "",
            };
            selectedToken = null;

            await loadTokens();
        } catch (error) {
            console.error("Token submission error:", error);
            toast.error(
                selectedToken
                    ? "Failed to update token"
                    : "Failed to create token",
            );
        }
    }

    function handleEdit(token: Token) {
        selectedToken = token;
        customTokenForm = {
            provider: token.provider || "",
            account: token.account || "",
            access_token: token.access_token || "",
            token_type: token.token_type || "Bearer",
            refresh_token: token.refresh_token || "",
            scope: token.scope || "",
        };
        showCustomTokenDialog = true;
    }

    function handleDelete(id: string) {
        tokenToDelete = id;
        showDeleteDialog = true;
    }

    async function confirmDelete() {
        if (!tokenToDelete) return;
        try {
            await pb.collection("tokens").delete(tokenToDelete);
            toast.success("Token deleted successfully");
            loadTokens();
        } catch (error) {
            toast.error("Failed to delete token");
        } finally {
            showDeleteDialog = false;
            tokenToDelete = null;
        }
    }

    async function handleToggleStatus(id: string, currentStatus: boolean) {
        try {
            await pb.collection("tokens").update(id, {
                is_active: !currentStatus,
            });
            toast.success("Token status updated");
            loadTokens();
        } catch (error) {
            toast.error("Failed to update token status");
        }
    }

    // Email auth
    async function handleEmailAuth() {
        try {
            const authUrl = await mailStore.startAuth();
            if (authUrl) {
                authWindow = window.open(
                    authUrl,
                    "auth",
                    "width=600,height=800",
                );
                showIntegrationsDialog = false;
            } else {
                toast.error("Failed to get email authentication URL");
            }
        } catch (error) {
            console.error("Email auth error:", error);
            toast.error("Failed to start email authentication");
        }
    }

    // Calendar auth
    async function handleCalendarAuth() {
        console.log("Starting calendar auth...");
        try {
            // Log that we're about to call startAuth
            console.log("Calling calendarStore.startAuth()");

            const authUrl = await calendarStore.startAuth();
            console.log(
                "Auth URL response:",
                authUrl ? "Received URL" : "No URL received",
            );

            if (authUrl) {
                console.log("Opening auth window with URL");
                authWindow = window.open(
                    authUrl,
                    "auth",
                    "width=600,height=800",
                );

                if (!authWindow) {
                    console.error(
                        "Failed to open popup window - it may have been blocked",
                    );
                    toast.error(
                        "Popup window was blocked. Please allow popups for this site.",
                    );
                } else {
                    showIntegrationsDialog = false;
                }
            } else {
                console.error(
                    "No auth URL returned from calendarStore.startAuth()",
                );
                toast.error("Failed to get calendar authentication URL");
            }
        } catch (error) {
            console.error("Calendar auth error:", error);
            toast.error("Failed to start calendar authentication");
        }
    }

    function handleMessage(event: MessageEvent) {
        if (event.data === "AUTH_COMPLETE") {
            toast.success("Authentication complete!");
            if (authWindow) {
                authWindow.close();
                authWindow = null;
            }

            // Refresh tokens after successful auth
            loadTokens();
        }
    }

    onMount(() => {
        loadTokens();
        window.addEventListener("message", handleMessage);
        return () => {
            window.removeEventListener("message", handleMessage);
            if (authWindow) authWindow.close();
        };
    });
</script>

<div class="p-6">
    <div class="flex justify-between items-center mb-6">
        <h2 class="text-3xl font-bold">API Tokens</h2>
        <div class="flex space-x-2">
            <Button variant="outline" on:click={loadTokens}>
                <RefreshCcw class="w-4 h-4 mr-2" />
                Refresh
            </Button>
            <Button
                on:click={() => {
                    showIntegrationsDialog = true;
                }}
            >
                <Plus class="w-4 h-4 mr-2" />
                New Token
            </Button>
        </div>
    </div>

    {#if loading}
        <div class="flex justify-center items-center h-64">
            <RefreshCcw class="w-8 h-8 animate-spin" />
        </div>
    {:else if tokens.length === 0}
        <div class="flex flex-col items-center justify-center h-64 text-center">
            <p class="text-muted-foreground mb-4">No API tokens found</p>
            <Button
                on:click={() => {
                    showIntegrationsDialog = true;
                }}
            >
                <Plus class="w-4 h-4 mr-2" />
                Create your first token
            </Button>
        </div>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each tokens as token (token.id)}
                <TokenCard
                    {token}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleStatus={handleToggleStatus}
                />
            {/each}
        </div>
    {/if}
</div>

<!-- Integration Selection Dialog -->
<Dialog.Root
    bind:open={showIntegrationsDialog}
    onOpenChange={(isOpen) => {
        if (!isOpen) showIntegrationsDialog = false;
    }}
>
    <Dialog.Content class="sm:max-w-[600px]">
        <Dialog.Header>
            <Dialog.Title>Add New Integration</Dialog.Title>
            <Dialog.Description>
                Choose an integration type or create a custom token
            </Dialog.Description>
        </Dialog.Header>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
            <Card class="cursor-pointer hover:border-primary transition-colors">
                <button
                    class="w-full h-full text-left"
                    on:click={() => {
                        console.log("Email auth clicked");
                        handleEmailAuth();
                    }}
                >
                    <CardHeader class="pb-2">
                        <CardTitle class="text-lg flex items-center">
                            <Mail class="w-5 h-5 mr-2" />
                            Email
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p class="text-sm text-muted-foreground">
                            Connect your email account
                        </p>
                    </CardContent>
                </button>
            </Card>

            <Card class="cursor-pointer hover:border-primary transition-colors">
                <button
                    class="w-full h-full text-left"
                    on:click={() => {
                        console.log("Calendar auth clicked");
                        handleCalendarAuth();
                    }}
                >
                    <CardHeader class="pb-2">
                        <CardTitle class="text-lg flex items-center">
                            <Calendar class="w-5 h-5 mr-2" />
                            Calendar
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p class="text-sm text-muted-foreground">
                            Connect Google Calendar
                        </p>
                    </CardContent>
                </button>
            </Card>

            <Card class="cursor-pointer hover:border-primary transition-colors">
                <button
                    class="w-full h-full text-left"
                    on:click={() => {
                        console.log("Custom token clicked");
                        showIntegrationsDialog = false;
                        setTimeout(() => {
                            showCustomTokenDialog = true;
                        }, 100); // Slight delay to avoid dialog conflicts
                    }}
                >
                    <CardHeader class="pb-2">
                        <CardTitle class="text-lg flex items-center">
                            <Settings class="w-5 h-5 mr-2" />
                            Custom
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p class="text-sm text-muted-foreground">
                            Add a custom API token
                        </p>
                    </CardContent>
                </button>
            </Card>
        </div>
    </Dialog.Content>
</Dialog.Root>

<!-- Custom Token Dialog -->
<Dialog.Root
    bind:open={showCustomTokenDialog}
    onOpenChange={(isOpen) => {
        if (!isOpen) {
            showCustomTokenDialog = false;
            if (!selectedToken) {
                customTokenForm = {
                    provider: "",
                    account: "",
                    access_token: "",
                    token_type: "Bearer",
                    refresh_token: "",
                    scope: "",
                };
            }
            selectedToken = null;
        }
    }}
>
    <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
            <Dialog.Title>
                {selectedToken ? "Edit Token" : "Create Custom Token"}
            </Dialog.Title>
            <Dialog.Description>
                {selectedToken
                    ? "Modify your API token details"
                    : "Enter your custom token details"}
            </Dialog.Description>
        </Dialog.Header>

        <form
            class="space-y-4"
            on:submit|preventDefault={handleCustomTokenSubmit}
        >
            <div class="space-y-2">
                <label for="provider" class="text-sm font-medium"
                    >Provider *</label
                >
                <input
                    id="provider"
                    type="text"
                    class="w-full p-2 rounded-md border"
                    bind:value={customTokenForm.provider}
                    placeholder="Provider name"
                    required
                />
            </div>

            <div class="space-y-2">
                <label for="account" class="text-sm font-medium"
                    >Account *</label
                >
                <input
                    id="account"
                    type="text"
                    class="w-full p-2 rounded-md border"
                    bind:value={customTokenForm.account}
                    placeholder="Account name or email"
                    required
                />
            </div>

            <div class="space-y-2">
                <label for="access_token" class="text-sm font-medium"
                    >Access Token *</label
                >
                <input
                    id="access_token"
                    type="password"
                    class="w-full p-2 rounded-md border"
                    bind:value={customTokenForm.access_token}
                    placeholder="Enter access token"
                    required
                />
            </div>

            <div class="space-y-2">
                <label for="token_type" class="text-sm font-medium"
                    >Token Type</label
                >
                <select
                    id="token_type"
                    class="w-full p-2 rounded-md border"
                    bind:value={customTokenForm.token_type}
                >
                    <option value="Bearer">Bearer</option>
                    <option value="Basic">Basic</option>
                    <option value="OAuth">OAuth</option>
                </select>
            </div>

            <div class="space-y-2">
                <label for="refresh_token" class="text-sm font-medium"
                    >Refresh Token</label
                >
                <input
                    id="refresh_token"
                    type="password"
                    class="w-full p-2 rounded-md border"
                    bind:value={customTokenForm.refresh_token}
                    placeholder="Enter refresh token (optional)"
                />
            </div>

            <div class="space-y-2">
                <label for="scope" class="text-sm font-medium">Scope</label>
                <input
                    id="scope"
                    type="text"
                    class="w-full p-2 rounded-md border"
                    bind:value={customTokenForm.scope}
                    placeholder="Token scope (optional)"
                />
            </div>

            <Dialog.Footer>
                <Button
                    type="button"
                    variant="outline"
                    on:click={() => (showCustomTokenDialog = false)}
                >
                    Cancel
                </Button>
                <Button type="submit">
                    {selectedToken ? "Update" : "Create"} Token
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={showDeleteDialog}>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>Are you sure?</AlertDialog.Title>
            <AlertDialog.Description>
                This action cannot be undone. This will permanently delete the
                token.
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action on:click={confirmDelete}
                >Delete</AlertDialog.Action
            >
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>

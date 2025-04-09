<script lang="ts">
    import { Eye, EyeOff, Loader2 } from "lucide-svelte";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue,
    } from "$lib/components/ui/select";
    import DateTimePicker from "$components/DateTimePicker.svelte";
    import { PROVIDERS, DEFAULT_TOKEN_FORM } from "../constants";
    import type { Token } from "../types";
    import { toast } from "svelte-sonner";
    import { calendarStore } from "$lib/features/calendar/stores/calendar.store";
    import { onMount, onDestroy } from "svelte";

    export let open = false;
    export let onClose: () => void;
    export let onSubmit: (data: any) => Promise<void>;
    export let selectedToken: Token | null = null;

    let showTokenValue = false;
    let showRefreshTokenValue = false;
    let formData = selectedToken
        ? { ...selectedToken }
        : { ...DEFAULT_TOKEN_FORM };
    let expiryDate = selectedToken?.expiry
        ? new Date(selectedToken.expiry)
        : null;
    let isSubmitting = false;
    let authWindow: Window | null = null;
    let showOAuthUI = false;

    $: if (!open) {
        formData = selectedToken
            ? { ...selectedToken }
            : { ...DEFAULT_TOKEN_FORM };
        expiryDate = selectedToken?.expiry
            ? new Date(selectedToken.expiry)
            : null;
        showTokenValue = false;
        showRefreshTokenValue = false;
        showOAuthUI = false;
    }

    $: {
        console.log("Dialog state:", { open, provider: formData.provider });
        showOAuthUI = formData.provider === "google_calendar" && !selectedToken;
    }

    function handleProviderChange(value: string) {
        console.log("Provider changed to:", value);
        formData.provider = value;
    }

    function handleExpiryChange(date: Date | null) {
        expiryDate = date;
    }

    // Google Calendar OAuth
    async function handleCalendarAuthClick() {
        try {
            console.log("Starting calendar auth...");
            const authUrl = await calendarStore.startAuth();
            console.log("Auth URL received:", authUrl ? "yes" : "no");
            if (authUrl) {
                authWindow = window.open(
                    authUrl,
                    "auth",
                    "width=600,height=800",
                );
            } else {
                toast.error("Failed to get authentication URL");
            }
        } catch (error) {
            console.error("Error starting calendar auth:", error);
            toast.error("Failed to start authentication process");
        }
    }

    function handleMessage(event: MessageEvent) {
        console.log("Received message:", event.data);
        if (event.data === "AUTH_COMPLETE") {
            if (authWindow) {
                authWindow.close();
                authWindow = null;
                toast.success("Calendar authentication successful!");
                // Auto fetch the token details after successful auth
                fetchLatestCalendarToken();
            }
        }
    }

    async function fetchLatestCalendarToken() {
        try {
            isSubmitting = true;
            console.log("Checking calendar status...");
            const status = await calendarStore.checkStatus(true);
            console.log("Calendar status:", status);

            if (status) {
                console.log("Fetching calendar token...");
                const tokenResult = await fetch("/api/calendar/token", {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                console.log("Token result status:", tokenResult.status);
                if (tokenResult.ok) {
                    const tokenData = await tokenResult.json();
                    console.log("Token data received:", tokenData);

                    if (tokenData && tokenData.id) {
                        console.log(
                            "Creating calendar token with ID:",
                            tokenData.id,
                        );
                        // Use the calendar token ID to create a calendar sync
                        const success = await calendarStore.createCalendarToken(
                            "Google Calendar",
                            "google_calendar",
                            tokenData.id,
                        );

                        console.log(
                            "Calendar token creation:",
                            success ? "success" : "failed",
                        );
                        if (success) {
                            toast.success(
                                "Google Calendar connected successfully",
                            );
                            // Close dialog after successful token creation
                            onClose();
                        }
                    }
                } else {
                    toast.error("Failed to fetch token data");
                }
            } else {
                toast.error("Calendar authentication check failed");
            }
        } catch (error) {
            console.error("Error fetching calendar token:", error);
            toast.error("Failed to fetch calendar token details");
        } finally {
            isSubmitting = false;
        }
    }

    async function handleSubmit() {
        if (!formData.provider || !formData.account || !formData.access_token) {
            toast.error("Please fill in all required fields");
            return;
        }

        isSubmitting = true;
        try {
            await onSubmit({
                ...formData,
                expiry: expiryDate?.toISOString() || null,
            });
        } catch (error) {
            console.error("Submit error:", error);
            toast.error("Failed to submit token");
        } finally {
            isSubmitting = false;
        }
    }

    onMount(() => {
        console.log("TokenDialog mounted, adding message listener");
        window.addEventListener("message", handleMessage);
    });

    onDestroy(() => {
        console.log("TokenDialog destroyed, removing message listener");
        window.removeEventListener("message", handleMessage);
        if (authWindow) {
            authWindow.close();
        }
    });
</script>

<Dialog.Root bind:open onOpenChange={onClose}>
    <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
            <Dialog.Title>
                {selectedToken ? "Edit Token" : "Create New Token"}
            </Dialog.Title>
            <Dialog.Description>
                {selectedToken
                    ? "Modify your API token details"
                    : "Add a new API token for integration"}
            </Dialog.Description>
        </Dialog.Header>

        {#if showOAuthUI}
            <div class="space-y-4 p-4">
                <p class="text-sm text-muted-foreground">
                    Click below to authenticate with Google Calendar. You'll be
                    redirected to sign in with your Google account.
                </p>
                <Button
                    class="w-full"
                    on:click={handleCalendarAuthClick}
                    disabled={isSubmitting}
                >
                    {#if isSubmitting}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                        Authenticating...
                    {:else}
                        Connect Google Calendar
                    {/if}
                </Button>
            </div>
        {:else}
            <form class="space-y-4" on:submit|preventDefault={handleSubmit}>
                <div class="space-y-2">
                    <Label for="provider">Provider *</Label>
                    <Select value={formData.provider}>
                        <SelectTrigger class="w-full">
                            <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                            {#each PROVIDERS as provider}
                                <SelectItem
                                    value={provider.value}
                                    on:click={() =>
                                        handleProviderChange(provider.value)}
                                >
                                    {provider.label}
                                </SelectItem>
                            {/each}
                        </SelectContent>
                    </Select>
                </div>

                <div class="space-y-2">
                    <Label for="account">Account *</Label>
                    <Input
                        id="account"
                        bind:value={formData.account}
                        placeholder="Account name or email"
                        required
                    />
                </div>

                <div class="space-y-2">
                    <Label for="access_token">Access Token *</Label>
                    <div class="relative">
                        <Input
                            id="access_token"
                            type={showTokenValue ? "text" : "password"}
                            bind:value={formData.access_token}
                            placeholder="Enter access token"
                            required
                        />
                        <button
                            type="button"
                            class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            on:click={() => (showTokenValue = !showTokenValue)}
                        >
                            {#if showTokenValue}
                                <EyeOff class="w-4 h-4" />
                            {:else}
                                <Eye class="w-4 h-4" />
                            {/if}
                        </button>
                    </div>
                </div>

                <div class="space-y-2">
                    <Label for="token_type">Token Type</Label>
                    <Select bind:value={formData.token_type}>
                        <SelectTrigger class="w-full">
                            <SelectValue placeholder="Select token type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Bearer">Bearer</SelectItem>
                            <SelectItem value="Basic">Basic</SelectItem>
                            <SelectItem value="OAuth">OAuth</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div class="space-y-2">
                    <Label for="refresh_token">Refresh Token</Label>
                    <div class="relative">
                        <Input
                            id="refresh_token"
                            type={showRefreshTokenValue ? "text" : "password"}
                            bind:value={formData.refresh_token}
                            placeholder="Enter refresh token (optional)"
                        />
                        <button
                            type="button"
                            class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            on:click={() =>
                                (showRefreshTokenValue =
                                    !showRefreshTokenValue)}
                        >
                            {#if showRefreshTokenValue}
                                <EyeOff class="w-4 h-4" />
                            {:else}
                                <Eye class="w-4 h-4" />
                            {/if}
                        </button>
                    </div>
                </div>

                <div class="space-y-2">
                    <Label for="expiry">Expiry Date</Label>
                    <DateTimePicker
                        id="expiry"
                        value={expiryDate}
                        on:change={(e) => handleExpiryChange(e.detail)}
                        placeholder="Select expiry date and time"
                    />
                </div>

                <div class="space-y-2">
                    <Label for="scope">Scope</Label>
                    <Input
                        id="scope"
                        bind:value={formData.scope}
                        placeholder="Token scope (optional)"
                    />
                </div>

                <Dialog.Footer>
                    <Button type="button" variant="outline" on:click={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting
                            ? selectedToken
                                ? "Updating..."
                                : "Creating..."
                            : selectedToken
                              ? "Update"
                              : "Create"} Token
                    </Button>
                </Dialog.Footer>
            </form>
        {/if}
    </Dialog.Content>
</Dialog.Root>

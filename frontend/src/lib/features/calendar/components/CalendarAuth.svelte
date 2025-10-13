<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Calendar, Loader2, Check } from "lucide-svelte";
    import { CalendarService } from "../services";

    let authWindow: Window | null = null;
    let isLoading = $state(false);
    let isAuthenticating = $state(false);
    let isConnected = $state(false);

    async function checkStatus() {
        isLoading = true;
        try {
            const status = await CalendarService.checkStatus();
            isConnected = !!status;
        } catch (error) {
            console.error("Failed to check calendar status:", error);
            isConnected = false;
        } finally {
            isLoading = false;
        }
    }

    async function handleAuthClick() {
        isAuthenticating = true;
        try {
            const authUrl = await CalendarService.startAuth();
            if (authUrl) {
                authWindow = window.open(
                    authUrl,
                    "auth",
                    "width=600,height=800",
                );
            }
        } catch (error) {
            console.error("Failed to start auth:", error);
        } finally {
            isAuthenticating = false;
        }
    }

    function handleMessage(event: MessageEvent) {
        if (event.data === "AUTH_COMPLETE") {
            checkStatus();
            if (authWindow) {
                authWindow.close();
                authWindow = null;
            }
        }
    }

    onMount(() => {
        checkStatus();
        window.addEventListener("message", handleMessage);
    });

    onDestroy(() => {
        window.removeEventListener("message", handleMessage);
        if (authWindow) {
            authWindow.close();
        }
    });
</script>

<Card class="w-full max-w-md mx-auto">
    <CardHeader>
        <CardTitle class="flex items-center gap-2">
            <Calendar class="h-5 w-5" />
            Calendar Integration
        </CardTitle>
        <CardDescription>
            Connect your Google Calendar to enable calendar sync
        </CardDescription>
    </CardHeader>

    <CardContent>
        {#if isLoading}
            <div class="flex justify-center items-center py-8">
                <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        {:else if isConnected}
            <div
                class="flex items-center gap-4 text-green-600 dark:text-green-500"
            >
                <Check class="h-6 w-6" />
                <span>Calendar sync is active</span>
            </div>
        {:else}
            <div class="space-y-4">
                <p class="text-sm text-muted-foreground">
                    Click below to start the authentication process. You'll be
                    redirected to sign in with your Google account.
                </p>
                <Button
                    class="w-full"
                    on:click={handleAuthClick}
                    disabled={isAuthenticating}
                >
                    {#if isAuthenticating}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                        Authenticating...
                    {:else}
                        Connect Google Calendar
                    {/if}
                </Button>
            </div>
        {/if}
    </CardContent>
</Card>

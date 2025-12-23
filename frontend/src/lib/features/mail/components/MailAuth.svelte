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
    import { Mail, Loader2, Check } from "lucide-svelte";
    import { mailStore } from "../stores";

    let authWindow: Window | null = null;

    async function handleAuthClick() {
        const authUrl = await mailStore.startAuth();
        if (authUrl) {
            authWindow = window.open(authUrl, "auth", "width=600,height=800");
        }
    }

    function handleMessage(event: MessageEvent) {
        if (event.data === "AUTH_COMPLETE") {
            // Refresh the status when auth is complete
            mailStore.checkStatus(true);
            if (authWindow) {
                authWindow.close();
                authWindow = null;
            }
        }
    }

    onMount(() => {
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
            <Mail class="h-5 w-5" />
            Mail Integration
        </CardTitle>
        <CardDescription>
            Connect your email account to enable mail sync
        </CardDescription>
    </CardHeader>

    <CardContent>
        {#if mailStore.isLoading}
            <div class="flex justify-center items-center py-8">
                <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        {:else if mailStore.isAuthenticated}
            <div
                class="flex items-center gap-4 text-green-600 dark:text-green-500"
            >
                <Check class="h-6 w-6" />
                <span>Mail sync is active</span>
            </div>
        {:else}
            <div class="space-y-4">
                <p class="text-sm text-muted-foreground">
                    Click below to start the authentication process. You'll be
                    redirected to sign in with your email provider.
                </p>
                <Button
                    class="w-full"
                    on:click={handleAuthClick}
                    disabled={mailStore.isAuthenticating}
                >
                    {#if mailStore.isAuthenticating}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                        Authenticating...
                    {:else}
                        Connect Mail Account
                    {/if}
                </Button>
            </div>
        {/if}
    </CardContent>
</Card>

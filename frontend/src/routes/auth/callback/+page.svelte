<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { Loader2 } from "lucide-svelte";
    import { mailStore } from "$lib/features/mail";
    import { CalendarService } from "$lib/features/calendar";

    let error: string | null = null;
    let isProcessing = true;

    async function handleCallback() {
        const code = $page.url.searchParams.get("code");
        const scope = $page.url.searchParams.get("scope") || "";

        if (!code) {
            error = "No authentication code received";
            isProcessing = false;
            return;
        }

        try {
            // Check if the scope is for email or calendar
            console.log("scope", scope);
            if (scope.includes("gmail.readonly")) {
                console.log("email");
                const success = await mailStore.completeAuth(code);
                if (success) {
                    // Wait for status check to complete before closing
                    await mailStore.checkStatus(true);
                }
                if (!success) {
                    throw new Error("Email authentication failed");
                }
            } else if (scope.includes("calendar.readonly")) {
                console.log("calendar");
                await CalendarService.completeAuth(code);
                console.log("Calendar auth completed");
                // Wait for status check to complete before closing
                await CalendarService.checkStatus(true);
            } else {
                throw new Error("Unknown authentication scope");
            }

            window.close();
            // Optionally notify the opener window
            if (window.opener) {
                window.opener.postMessage("AUTH_COMPLETE", "*");
            }
        } catch (e) {
            console.error("Auth callback error:", e);
            error =
                e instanceof Error
                    ? e.message
                    : "Failed to complete authentication";
        } finally {
            isProcessing = false;
        }
    }

    onMount(() => {
        handleCallback();
    });
</script>

<div class="flex min-h-screen items-center justify-center">
    {#if error}
        <div class="text-destructive text-center">
            <p>{error}</p>
            <p class="text-sm text-muted-foreground mt-2">
                You can close this window
            </p>
        </div>
    {:else if isProcessing}
        <div class="text-center space-y-4">
            <Loader2 class="h-8 w-8 animate-spin mx-auto" />
            <p class="text-muted-foreground">Completing authentication...</p>
        </div>
    {:else}
        <div class="text-center space-y-4">
            <p class="text-green-600">Authentication successful!</p>
            <p class="text-sm text-muted-foreground">
                You can close this window
            </p>
        </div>
    {/if}
</div>

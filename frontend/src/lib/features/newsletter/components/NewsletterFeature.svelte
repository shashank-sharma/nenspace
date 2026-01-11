<script lang="ts">
    import { onMount } from "svelte";
    import { newsletterStore } from "../stores/newsletter.store.svelte";
    import NewsletterOnboarding from "./NewsletterOnboarding.svelte";
    import NewsletterList from "./NewsletterList.svelte";
    import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
    import { AlertCircle, Mail, Settings2, Trash2 } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
    import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
    import { useModalState } from "$lib/hooks";
    import { fade } from "svelte/transition";

    const settingsModal = useModalState();

    onMount(() => {
        newsletterStore.initialize();
    });

    async function handleDisable() {
        await newsletterStore.disableNewsletter();
        settingsModal.closeAll();
    }
</script>

<div class="h-full flex flex-col gap-6 p-6 overflow-y-auto">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-3xl font-bold tracking-tight flex items-center gap-3">
                <div class="p-2 rounded-xl bg-primary/10">
                    <Mail class="w-8 h-8 text-primary" />
                </div>
                Newsletters
            </h1>
            <p class="text-muted-foreground">
                Manage and track your email subscriptions in one place.
            </p>
        </div>

        {#if newsletterStore.isEnabled}
            <div class="flex items-center gap-2">
                <Button variant="outline" size="sm" onclick={() => settingsModal.openEdit()} class="gap-2">
                    <Settings2 class="w-4 h-4" />
                    Settings
                </Button>
            </div>
        {/if}
    </div>

    {#if newsletterStore.isLoading && !newsletterStore.settings}
        <div class="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" label="Loading newsletter dashboard..." />
        </div>
    {:else if newsletterStore.error}
        <div class="flex-1 flex flex-col items-center justify-center gap-4 text-center max-w-md mx-auto" in:fade>
            <div class="p-4 rounded-full bg-destructive/10">
                <AlertCircle class="w-12 h-12 text-destructive" />
            </div>
            <div class="space-y-2">
                <h2 class="text-xl font-semibold">Something went wrong</h2>
                <p class="text-muted-foreground">{newsletterStore.error}</p>
            </div>
            <Button variant="outline" onclick={() => newsletterStore.initialize()}>
                Try Again
            </Button>
        </div>
    {:else if !newsletterStore.isEnabled}
        <div class="flex-1" in:fade>
            <NewsletterOnboarding />
        </div>
    {:else}
        <div class="flex-1" in:fade>
            <NewsletterList />
        </div>
    {/if}
</div>

<!-- Settings Modal -->
<ConfirmDialog 
    bind:open={settingsModal.editModalOpen}
    title="Newsletter Settings"
    description="Manage your newsletter detection preferences."
    confirmText="Disable Feature"
    variant="destructive"
    onconfirm={handleDisable}
>
    <div class="py-4 space-y-4">
        <div class="p-4 rounded-lg bg-muted/50 border border-border/50">
            <div class="flex justify-between items-center">
                <div>
                    <p class="font-medium">Active Monitoring</p>
                    <p class="text-xs text-muted-foreground">Automatically scan incoming emails for newsletters.</p>
                </div>
                <div class="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
            </div>
        </div>
        <p class="text-sm text-muted-foreground px-1">
            Disabling this feature will stop automatic detection. Existing newsletter records will be preserved but no longer updated.
        </p>
    </div>
</ConfirmDialog>


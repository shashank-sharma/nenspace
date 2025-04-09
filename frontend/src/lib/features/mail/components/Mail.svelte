<script lang="ts">
    import { onMount } from "svelte";
    import { mailStore, mailMessagesStore } from "../stores";
    import MailLayout from "./MailLayout.svelte";
    import MailTable from "./MailTable.svelte";
    import MailDisplay from "./MailDisplay.svelte";
    import { browser } from "$app/environment";
    import { Loader2, AlertCircle, Mail as MailIcon } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { fade } from "svelte/transition";

    let mounted = false;
    let error: string | null = null;
    let initializing = true;

    onMount(async () => {
        console.log("Mail component mounted");
        mounted = true;

        try {
            // Check mail status first
            const status = await mailStore.checkStatus(true);
            if (status) {
                await mailMessagesStore.fetchMails();
                mailStore.subscribeToChanges();
                mailMessagesStore.subscribeToChanges();
            }
        } catch (err) {
            console.error("Error initializing mail component:", err);
            error = "Failed to load mail data. Please try again later.";
        } finally {
            initializing = false;
        }
    });

    $: if (browser && mounted) {
        console.log("Mail store state:", $mailStore);
        console.log("Mail messages state:", $mailMessagesStore);
    }
</script>

{#if initializing}
    <div
        class="flex items-center justify-center h-full bg-white dark:bg-slate-900"
        in:fade={{ duration: 150 }}
    >
        <div class="text-center">
            <Loader2 class="w-8 h-8 mx-auto animate-spin text-primary" />
            <p class="mt-4 text-sm text-slate-600 dark:text-slate-400">
                Initializing mail component...
            </p>
        </div>
    </div>
{:else if error}
    <div
        class="flex items-center justify-center h-full bg-white dark:bg-slate-900"
        in:fade={{ duration: 150 }}
    >
        <div
            class="text-center max-w-md p-6 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20"
        >
            <AlertCircle class="w-8 h-8 mx-auto text-red-500 mb-4" />
            <p class="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <Button
                variant="default"
                on:click={() => window.location.reload()}
                class="mx-auto"
            >
                Retry
            </Button>
        </div>
    </div>
{:else if !$mailStore.isAuthenticated}
    <div
        class="flex items-center justify-center h-full bg-white dark:bg-slate-900"
        in:fade={{ duration: 150 }}
    >
        <div
            class="text-center max-w-md p-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
        >
            <div
                class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4"
            >
                <MailIcon class="w-8 h-8" />
            </div>
            <h2 class="text-2xl font-bold mb-3 text-slate-900 dark:text-white">
                Connect Your Email
            </h2>
            <p class="text-slate-600 dark:text-slate-400 mb-6">
                Connect your Gmail account to start managing your emails
                directly from your dashboard.
            </p>
            <Button variant="default" size="lg" class="px-6" asChild>
                <a href="/auth/mail/redirect">Connect Gmail</a>
            </Button>
        </div>
    </div>
{:else}
    <MailLayout>
        <div class="flex h-full">
            <div
                class="w-[500px] border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
                <MailTable />
            </div>
            <div class="flex-1 bg-white dark:bg-slate-900">
                <MailDisplay />
            </div>
        </div>
    </MailLayout>
{/if}

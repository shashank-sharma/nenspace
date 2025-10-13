<script lang="ts">
    import { WifiOff, Wifi, RefreshCw } from "lucide-svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { NetworkService } from "$lib/services/network.service.svelte";
    import { fade, slide } from "svelte/transition";

    // Reactive state from NetworkService
    let isOnline = $derived(NetworkService.isOnline);
    let consecutiveFailures = $derived(NetworkService.consecutiveFailures);
</script>

{#if !isOnline}
    <div
        class="fixed top-4 right-4 z-50 flex items-center gap-2"
        transition:slide={{ duration: 300 }}
    >
        <Badge
            variant="destructive"
            class="flex items-center gap-2 px-3 py-2 text-sm font-medium shadow-lg"
        >
            <WifiOff class="h-4 w-4" />
            <span>Offline Mode</span>
        </Badge>
    </div>
{:else if consecutiveFailures > 0}
    <div class="fixed top-4 right-4 z-50" transition:fade={{ duration: 200 }}>
        <Badge
            variant="outline"
            class="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-yellow-500/10 border-yellow-500/50 text-yellow-600 dark:text-yellow-400"
        >
            <Wifi class="h-4 w-4" />
            <span>Connection unstable ({consecutiveFailures} failures)</span>
        </Badge>
    </div>
{/if}

<style>
    /* Pulse animation for offline indicator */
    @keyframes pulse-offline {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.7;
        }
    }
</style>

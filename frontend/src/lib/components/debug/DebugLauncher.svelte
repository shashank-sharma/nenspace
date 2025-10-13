<script lang="ts">
    import DebugPanel from "$lib/components/debug/DebugPanel.svelte";
    import { Bug, X } from "lucide-svelte";
    import { DebugService } from "$lib/services/debug.service.svelte";
    import { HealthService } from "$lib/services/health.service.svelte";
</script>

<div class="fixed bottom-4 right-4 z-50">
    {#if DebugService.isEnabled}
        <DebugPanel
            enabled={DebugService.isEnabled}
            on:close={DebugService.toggle}
        />
    {/if}

    <button
        class="debug-toggle"
        class:active={DebugService.isEnabled}
        class:border-green-500={HealthService.status.connected === true}
        class:border-yellow-500={HealthService.status.connected === null}
        class:border-red-500={HealthService.status.connected === false}
        onclick={DebugService.toggle}
        title="Toggle Debug Panel"
    >
        {#if DebugService.isEnabled}
            <X size={16} />
        {:else}
            <Bug size={16} />
        {/if}
    </button>
</div>

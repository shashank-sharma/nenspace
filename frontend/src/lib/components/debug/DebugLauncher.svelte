<script lang="ts">
    import { onMount } from "svelte";
    import { Settings } from "lucide-svelte";
    import DebugPanel from "$lib/components/debug/DebugPanel.svelte";
    import { Button } from "$lib/components/ui/button";
    import { backendStatus } from "$lib/config/pocketbase";

    // Debug panel visibility
    let showDebugPanel = false;

    onMount(() => {
        // Check if Debug Mode is enabled
    });

    function toggleDebugPanel() {
        showDebugPanel = !showDebugPanel;
    }

    // Define the border class based on backend status
    $: borderClass =
        $backendStatus.connected === null
            ? "border-muted"
            : $backendStatus.connected
              ? "border-green-500"
              : "border-red-500";
</script>

<!-- Floating Settings Button (always visible) -->
<div class="fixed bottom-4 right-4 z-50">
    <Button
        variant="outline"
        size="icon"
        class="rounded-full h-10 w-10 shadow-lg bg-background relative border-2 {borderClass} transition-colors duration-300"
        on:click={toggleDebugPanel}
        title={$backendStatus.connected
            ? "Settings & Debug (Backend Connected)"
            : "Settings & Debug (Backend Offline)"}
    >
        <Settings class="h-4 w-4" />
    </Button>
</div>

<!-- Debug Panel with component-based approach -->
<DebugPanel
    bind:enabled={showDebugPanel}
    initialPosition={{ x: window.innerWidth - 420, y: 20 }}
    width={380}
/>

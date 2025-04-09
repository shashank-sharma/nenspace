<script lang="ts">
    import { onMount } from "svelte";
    import { checkBackendHealth } from "$lib/config/pocketbase";

    onMount(() => {
        // Run health check once when auth layout loads
        checkBackendHealth();
    });
</script>

<div class="min-h-screen flex flex-col">
    <slot />
</div>

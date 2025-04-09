<script lang="ts">
    import { Bug } from "lucide-svelte";
    import type { ComponentType } from "svelte";

    export let enabled = false;
    export let icon: ComponentType = Bug;
    export let title = "Toggle Debug Panel";
    export let color = "text-green-500";
</script>

<button
    class="debug-toggle"
    class:active={enabled}
    on:click={() => (enabled = !enabled)}
    {title}
>
    <svelte:component this={icon} size={16} />
</button>

<style>
    .debug-toggle {
        position: relative;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: rgba(39, 39, 42, 0.8);
        color: #a1a1aa;
        border: 1px solid rgba(63, 63, 70, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: all 0.2s ease;
    }

    .debug-toggle:hover {
        background-color: rgba(63, 63, 70, 0.9);
        color: #f1f1f1;
    }

    .debug-toggle.active {
        background-color: rgba(22, 163, 74, 0.8);
        color: white;
    }
</style>

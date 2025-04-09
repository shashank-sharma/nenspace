<script lang="ts" context="module">
    export interface DebugSection {
        id: string;
        title: string;
        items: DebugItem[];
        expanded?: boolean;
    }

    export interface DebugItem {
        id: string;
        label: string;
        component: any;
        props?: Record<string, any>;
    }
</script>

<script lang="ts">
    import DebugContainer from "./DebugContainer.svelte";

    // Props for the legacy DebugPanel
    export let enabled: boolean = false;
    export let sections: DebugSection[] = [];
    export let initialPosition = { x: window.innerWidth - 420, y: 20 };
    export let width = 380;

    // Handle close event from DebugContainer
    function handleClose() {
        enabled = false;
    }
</script>

<!-- Instead of implementing the Debug Panel directly, use our new modular container -->
<DebugContainer {enabled} {initialPosition} {width} on:close={handleClose} />

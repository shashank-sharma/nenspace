<script lang="ts">
    import DashboardSidebar from "./DashboardSidebar.svelte";
    import DashboardHeader from "./DashboardHeader.svelte";
    import { fade, scale } from "svelte/transition";
    import type { DashboardSection } from "../types";
    import { onMount, onDestroy, type Snippet } from "svelte";

    let { sections, children } = $props<{
        sections: DashboardSection[];
        children: Snippet;
    }>();

    let isMobileView = $state(false);

    function checkMobileState() {
        isMobileView = window.innerWidth < 768;
    }

    onMount(() => {
        checkMobileState();
        window.addEventListener("resize", checkMobileState);

        return () => {
            window.removeEventListener("resize", checkMobileState);
        };
    });
</script>

<div class="flex flex-col h-screen bg-background" in:fade={{ duration: 150 }}>
    <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
        <DashboardSidebar {sections} isMobile={isMobileView} />

        <div class="flex-1 flex flex-col overflow-hidden">
            <DashboardHeader />

            <main class="flex-1 overflow-auto p-0">
                {@render children()}
                {#if isMobileView}
                    <!-- Spacer to prevent content from being hidden behind the mobile navigation -->
                    <div class="h-20 w-full mt-6"></div>
                {/if}
            </main>
        </div>
    </div>
</div>

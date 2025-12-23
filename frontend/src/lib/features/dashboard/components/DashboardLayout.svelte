<script lang="ts">
    import DashboardSidebar from "./DashboardSidebar.svelte";
    import DashboardHeader from "./DashboardHeader.svelte";
    import FullscreenSettingsModal from "$lib/components/FullscreenSettingsModal.svelte";
    import BackgroundPattern from "$lib/components/BackgroundPattern.svelte";
    import { SettingsService } from "$lib/services/settings.service.svelte";
    import { fade, scale } from "svelte/transition";
    import type { DashboardSection } from "../types";
    import { onMount, onDestroy, type Snippet } from "svelte";

    let { sections, children, onShowShortcuts } = $props<{
        sections: DashboardSection[];
        children: Snippet;
        onShowShortcuts?: () => void;
    }>();

    let isMobileView = $state(false);
    let settingsLoaded = $state(false);
    
    // Reactive state for settings loading
    let isSettingsLoading = $derived(SettingsService.isInitialLoading);
    let isSettingsReady = $derived(SettingsService.isInitialized);
    
    // Reactive background pattern type from settings
    let backgroundType = $derived(SettingsService.appearance.backgroundType);

    function checkMobileState() {
        isMobileView = window.innerWidth < 768;
    }

    onMount(async () => {
        checkMobileState();
        window.addEventListener("resize", checkMobileState);

        // Ensure settings are loaded during dashboard initialization
        console.log('[Dashboard] Initializing dashboard - loading user settings...');
        
        try {
            await SettingsService.ensureLoaded();
            settingsLoaded = true;
            console.log('[Dashboard] Settings loaded successfully');
        } catch (error) {
            console.error('[Dashboard] Failed to load settings:', error);
            // Don't block dashboard loading if settings fail
            settingsLoaded = true;
        }

        return () => {
            window.removeEventListener("resize", checkMobileState);
        };
    });
</script>

<div class="flex flex-col h-screen bg-background relative" in:fade={{ duration: 150 }}>
    <!-- Background Pattern -->
    <BackgroundPattern type={backgroundType} />
    
    <div class="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">
        <DashboardSidebar {sections} isMobile={isMobileView} />

        <div class="flex-1 flex flex-col overflow-hidden">
            <DashboardHeader on:show-shortcuts={onShowShortcuts} />

            <main class="flex-1 overflow-auto p-0">
                {@render children()}
                {#if isMobileView}
                    <!-- Spacer to prevent content from being hidden behind the mobile navigation -->
                    <div class="h-20 w-full mt-6"></div>
                {/if}
            </main>
        </div>
    </div>
    
    <!-- Settings Modal -->
    <FullscreenSettingsModal />
</div>

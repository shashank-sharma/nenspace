<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { Button } from "$lib/components/ui/button";
    import { cn } from "$lib/utils";
    import { authService } from "$lib/services/authService.svelte";
    import { SettingsModalService } from "$lib/services/settings-modal.service.svelte";
    import type { DashboardSection } from "../types";
    import Logo from "$lib/components/Logo.svelte";
    import {
        ChevronLeft,
        ChevronRight,
        ChevronDown,
        ChevronUp,
        Settings,
    } from "lucide-svelte";
    import { slide } from "svelte/transition";
    import { tweened } from "svelte/motion";
    import { cubicOut } from "svelte/easing";
    import { tick } from "svelte";

    let { sections, isMobile = false } = $props<{
        sections: DashboardSection[];
        isMobile?: boolean;
    }>();

    let mobileExpandedSection = $state<string | null>(null);

    let isCollapsed = $state(false);
    let prevPath: string = "";
    let activeMobileSection: string | null = null;
    const width = tweened(256, {
        duration: 200,
        easing: cubicOut,
    });

    // Store for tracking which sections are expanded
    let expandedSections = $state<Record<string, boolean>>({});

    $effect(() => {
        width.set(isCollapsed ? 84 : 256);
    });

    let currentPath = $derived($page.url.pathname);

    // Reactive statement to update active sections when path changes
    $effect(() => {
        // Use tick to defer state updates until after the current render cycle
        tick().then(() => {
            updateActiveSection(currentPath);
        });
    });

    function toggleSidebar() {
        isCollapsed = !isCollapsed;
    }

    function toggleSection(sectionId: string, event?: Event) {
        if (event) {
            event.stopPropagation();
        }

        if (isMobile) {
            // In mobile, only one section can be expanded at a time
            mobileExpandedSection =
                mobileExpandedSection === sectionId ? null : sectionId;
        } else {
            expandedSections = {
                ...expandedSections,
                [sectionId]: !expandedSections[sectionId],
            };
        }
    }

    function navigateToSection(section: DashboardSection) {
        // dashboardStore.setActiveSection(section.id); // Removed as per new architecture

        // If this is a section with children on mobile, toggle expansion instead of navigating
        if (isMobile && section.collapsible && section.children?.length) {
            toggleSection(section.id);
        }

        goto(section.path);
    }

    function navigateToChildSection(child: DashboardSection) {
        // dashboardStore.setActiveSection(child.id); // Removed as per new architecture
        goto(child.path);
        // Close the mobile expanded section after navigation
        if (isMobile) {
            mobileExpandedSection = null;
        }
    }

    // Check if the given path is or contains the active path
    function isActive(path: string): boolean {
        return currentPath === path || currentPath.startsWith(`${path}/`);
    }

    // Update the active section based on the current path
    function updateActiveSection(path: string) {
        // Find the active section and set it in the store
        let activeSection = "";
        for (const section of sections) {
            if (section.path === path) {
                activeSection = section.id;
                break;
            }

            if (section.children) {
                for (const child of section.children) {
                    if (child.path === path) {
                        activeSection = child.id;

                        // If a child is active, also mark its parent as expanded
                        if (isMobile) {
                            mobileExpandedSection = section.id;
                        }
                        break;
                    }
                }
                if (activeSection) break;
            }
        }

        // dashboardStore.setActiveSection(activeSection); // Removed as per new architecture

        // Update expanded sections
        sections.forEach((section: DashboardSection) => {
            if (section.collapsible && section.children) {
                const hasActiveChild = section.children.some(
                    (child: DashboardSection) => isActive(child.path),
                );
                if (hasActiveChild || section.path === path) {
                    expandedSections = {
                        ...expandedSections,
                        [section.id]: true,
                    };
                }
            }
        });
    }
</script>

{#if isMobile}
    <!-- Mobile Bottom Navigation Bar -->
    <nav
        class="fixed bottom-0 left-0 right-0 bg-card border-t z-50 p-2 shadow-lg"
    >
        <div
            class="flex items-center space-x-3 overflow-x-auto scrollbar-hidden px-1"
        >
            {#each sections as section}
                <div class="flex-shrink-0">
                    <Button
                        variant={currentPath === section.path
                            ? "secondary"
                            : "ghost"}
                        class={"flex flex-col items-center justify-center h-16 w-16 p-1 rounded-lg relative"}
                        on:click={() => navigateToSection(section)}
                    >
                        {#if section.icon}
                            <section.icon
                                class={cn(
                                    "h-5 w-5 mb-1",
                                    isActive(section.path) && "text-primary",
                                )}
                            />
                        {/if}
                        <span
                            class="text-[10px] text-center overflow-hidden text-ellipsis w-full"
                            >{section.label}</span
                        >

                        {#if section.collapsible && section.children?.length}
                            <div
                                class="absolute -top-0 -right-1 w-5 h-5 bg-secondary rounded-full flex items-center justify-center text-ellipsis text-[10px] font-bold"
                            >
                                {section.children.length}
                            </div>
                        {/if}
                    </Button>
                </div>
            {/each}
        </div>

        <!-- Mobile Subsections (when expanded) -->
        {#if mobileExpandedSection}
            {#each sections as section}
                {#if section.id === mobileExpandedSection && section.collapsible && section.children}
                    <div
                        class="mt-2 bg-card/95 backdrop-blur-sm border-t p-2 rounded-t-lg shadow-inner"
                        transition:slide={{ duration: 150 }}
                    >
                        <div class="flex flex-col space-y-1">
                            <div
                                class="flex items-center justify-between mb-1 px-2"
                            >
                                <span class="text-xs font-semibold opacity-70"
                                    >{section.label} Options</span
                                >
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="h-6 w-6 p-0"
                                    on:click={() =>
                                        (mobileExpandedSection = null)}
                                >
                                    Bad
                                    <ChevronDown class="h-4 w-4 rotate-180" />
                                </Button>
                            </div>
                            <div
                                class="flex items-center space-x-3 overflow-x-auto scrollbar-hidden py-1"
                            >
                                {#each section.children as child}
                                    <Button
                                        variant={currentPath === section.path
                                            ? "secondary"
                                            : "ghost"}
                                        class={"flex-shrink-0 flex items-center justify-center h-10 rounded-lg"}
                                        on:click={() =>
                                            navigateToChildSection(child)}
                                    >
                                        {#if child.icon}
                                            <child.icon
                                                class={cn(
                                                    "h-4 w-4 mr-2",
                                                    isActive(child.path) &&
                                                        "text-primary",
                                                )}
                                            />
                                        {/if}
                                        <span class="text-xs"
                                            >{child.label}</span
                                        >
                                    </Button>
                                {/each}
                            </div>
                        </div>
                    </div>
                {/if}
            {/each}
        {/if}
    </nav>

    <!-- Add custom style for hiding scrollbar but allowing scrolling -->
    <style>
        .scrollbar-hidden {
            -ms-overflow-style: none; /* IE and Edge */
            scrollbar-width: none; /* Firefox */
            padding-bottom: 5px;
            -webkit-overflow-scrolling: touch;
        }
        .scrollbar-hidden::-webkit-scrollbar {
            display: none; /* Chrome, Safari, Opera */
        }
    </style>
{:else}
    <!-- Desktop Sidebar -->
    <aside
        class="bg-card border-r flex flex-col h-screen transition-all duration-200 ease-out"
        style:width="{$width}px"
    >
        <div class="p-4 flex items-center justify-between">
            {#if !isCollapsed}
                <div class="flex items-center gap-3">
                    <div class="relative flex items-center justify-center opacity-70">
                        <Logo size={32} animated={false} solid={true} />
                    </div>
                    <div class="flex flex-col">
                        <span class="font-mono text-sm tracking-[0.2em] text-foreground"
                            >NENSPACE</span
                        >
                    </div>
                </div>
            {/if}
            <Button variant="ghost" size="icon" on:click={toggleSidebar}>
                {#if isCollapsed}
                    <ChevronRight class="h-4 w-4" />
                {:else}
                    <ChevronLeft class="h-4 w-4" />
                {/if}
            </Button>
        </div>

        <nav class="flex-1 px-2 py-4 space-y-1 overflow-y-scroll themed-scrollbar">
            {#each sections as section}
                <div>
                    <Button
                        variant={currentPath === section.path
                            ? "secondary"
                            : "ghost"}
                        class={cn(
                            "w-full justify-start",
                            isCollapsed && "justify-center px-2",
                            isCollapsed && section.collapsible && "relative",
                        )}
                        on:click={() => navigateToSection(section)}
                    >
                        {#if section.icon}
                            <section.icon class="h-4 w-4 mr-2" />
                        {/if}
                        {#if !isCollapsed}
                            <span class="flex-1 text-left">{section.label}</span
                            >
                            {#if section.collapsible}
                                <button
                                    class="cursor-pointer"
                                    onclick={(e) =>
                                        toggleSection(section.id, e)}
                                >
                                    <ChevronDown
                                        class={cn(
                                            "h-4 w-4 transition-transform",
                                            expandedSections[section.id]
                                                ? "rotate-180"
                                                : "",
                                        )}
                                    />
                                </button>
                            {/if}
                        {/if}
                    </Button>

                    {#if section.collapsible && section.children && expandedSections[section.id] && !isCollapsed}
                        <div
                            class="ml-6 mt-1 space-y-1"
                            transition:slide={{ duration: 150 }}
                        >
                            {#each section.children as child}
                                <Button
                                    variant={currentPath === child.path
                                        ? "secondary"
                                        : "ghost"}
                                    class="w-full justify-start"
                                    on:click={() => {
                                        // dashboardStore.setActiveSection( // Removed as per new architecture
                                        //     child.id,
                                        // );
                                        navigateToSection(child);
                                        goto(child.path);
                                    }}
                                >
                                    {#if child.icon}
                                        <child.icon class="h-4 w-4 mr-2" />
                                    {/if}
                                    <span>{child.label}</span>
                                </Button>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        </nav>

        <div class="p-4 border-t">
            {#if !isCollapsed}
                <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium truncate">
                            {authService.user?.username || "Guest"}
                        </p>
                        <p class="text-xs text-muted-foreground truncate">
                            {authService.user?.email || ""}
                        </p>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon"
                        class="h-8 w-8 flex-shrink-0"
                        on:click={SettingsModalService.open}
                    >
                        <Settings class="h-4 w-4" />
                        <span class="sr-only">Open settings</span>
                    </Button>
                </div>
            {/if}
        </div>
    </aside>
{/if}

<style>
    /* Theme-aware custom scrollbar for sidebar */
    .themed-scrollbar {
        scrollbar-width: thin; /* Firefox */
        scrollbar-color: hsl(var(--muted-foreground) / 0.5)
            hsl(var(--muted) / 0.2); /* thumb track */
    }

    .themed-scrollbar::-webkit-scrollbar {
        width: 10px;
    }

    .themed-scrollbar::-webkit-scrollbar-track {
        background: hsl(var(--muted) / 0.12);
        border-radius: 8px;
    }

    .themed-scrollbar::-webkit-scrollbar-thumb {
        background-color: hsl(var(--muted-foreground) / 0.45);
        border-radius: 8px;
        border: 2px solid hsl(var(--background));
    }

    .themed-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: hsl(var(--muted-foreground) / 0.6);
    }

    .themed-scrollbar::-webkit-scrollbar-thumb:active {
        background-color: hsl(var(--foreground) / 0.6);
    }
</style>

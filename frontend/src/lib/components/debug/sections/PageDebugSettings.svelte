<script lang="ts">
    import { browser } from "$app/environment";
    import { writable } from "svelte/store";
    import { slide } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { Button } from "$lib/components/ui/button";
    import { Switch } from "$lib/components/ui/switch";
    import { FileCode, ChevronDown, ChevronUp } from "lucide-svelte";

    // Import our registry and utilities
    import {
        getDebugSettingsForPath,
        getPageNameFromPath,
    } from "../registry/pageDebugRegistry";

    // Current route tracking
    import { page } from "$app/stores";

    // Track which sections are applicable to the current page
    $: currentPath = $page?.url?.pathname || "";
    $: applicableSections = getDebugSettingsForPath(currentPath);
    $: pageName = getPageNameFromPath(currentPath);

    // Initialize expanded sections set
    let expandedSections = new Set<string>();

    // Initialize expanded sections only once (not every reactive update)
    let initialized = false;
    $: if (applicableSections.length > 0 && !initialized) {
        initialized = true;
        // Initialize expanded state based on section defaults
        applicableSections.forEach((section) => {
            if (section.expanded) {
                expandedSections.add(section.id);
            }
        });
    }

    // Handle toggling section expansion
    function toggleSection(sectionId: string) {
        if (expandedSections.has(sectionId)) {
            expandedSections.delete(sectionId);
        } else {
            expandedSections.add(sectionId);
        }
        // Force update
        expandedSections = new Set(expandedSections);
    }
</script>

<div class="space-y-2">
    {#if applicableSections.length === 0}
        <div class="text-sm text-muted-foreground italic">
            No debug settings available for the {pageName} page.
        </div>
    {:else}
        <div class="text-sm text-muted-foreground mb-2">
            Debug settings for <span class="font-medium text-foreground"
                >{pageName}</span
            > page:
        </div>

        {#each applicableSections as section (section.id)}
            <div class="bg-card border rounded-md shadow-sm overflow-hidden">
                <button
                    class="w-full flex justify-between items-center p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                    on:click={() => toggleSection(section.id)}
                >
                    <span class="flex items-center gap-2">
                        <FileCode size={16} />
                        {section.title}
                    </span>
                    <span>
                        {#if expandedSections.has(section.id)}
                            <ChevronUp size={16} />
                        {:else}
                            <ChevronDown size={16} />
                        {/if}
                    </span>
                </button>

                {#if expandedSections.has(section.id)}
                    <div
                        class="px-3 pb-3 pt-1 bg-card/50"
                        transition:slide={{ duration: 200, easing: cubicOut }}
                    >
                        <svelte:component this={section.component} />
                    </div>
                {/if}
            </div>
        {/each}
    {/if}
</div>

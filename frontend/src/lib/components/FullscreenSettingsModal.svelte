<!--
  Fullscreen Settings Modal
  
  A Discord-style fullscreen modal that displays the existing settings page.
  Simple fullscreen modal without Dialog component to avoid type conflicts.
-->
<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { X } from "lucide-svelte";
    import { SettingsModalService } from "$lib/services/settings-modal.service.svelte";
    import SettingsPage from "../../routes/settings/+page.svelte";
    import { fade, scale } from "svelte/transition";

    // Bind to the service state
    let isOpen = $derived(SettingsModalService.isOpen);
</script>

{#if isOpen}
    <!-- Fullscreen overlay -->
    <div 
        class="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm"
        in:fade={{ duration: 200 }}
        out:fade={{ duration: 200 }}
    >
        <!-- Modal content -->
        <div 
            class="fixed inset-0 bg-background border-0 shadow-lg overflow-hidden flex flex-col"
            in:scale={{ duration: 200, start: 0.96 }}
            out:scale={{ duration: 200, start: 0.96 }}
        >
            <!-- Close button -->
            <div class="absolute top-4 right-4 z-10">
                <Button
                    variant="ghost"
                    size="icon"
                    class="rounded-full"
                    on:click={SettingsModalService.close}
                >
                    <X class="h-4 w-4" />
                    <span class="sr-only">Close settings</span>
                </Button>
            </div>

            <!-- Settings content -->
            <div class="flex-1 overflow-auto">
                <SettingsPage />
            </div>
        </div>
    </div>
{/if}

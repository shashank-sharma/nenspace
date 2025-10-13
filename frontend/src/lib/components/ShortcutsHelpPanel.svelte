<script lang="ts">
    import { X } from "lucide-svelte";
    import { fade, slide } from "svelte/transition";
    import { Button } from "$lib/components/ui/button";
    import { createEventDispatcher } from "svelte";

    let { visible = false } = $props<{ visible?: boolean }>();

    const dispatch = createEventDispatcher<{
        close: void;
    }>();

    const shortcuts = [
        { keys: ["⌘", "K"], description: "Open Command Palette" },
        { keys: ["⌘", "J"], description: "Toggle Command Dialog" },
        { keys: ["⌘", "["], description: "Navigate Back" },
        { keys: ["⌘", "]"], description: "Navigate Forward" },
        { keys: ["⌘", "R"], description: "Reload" },
        { keys: ["⌘", "⇧", "S"], description: "Save Page As" },
        { keys: ["⌘", "⇧", "B"], description: "Show Bookmarks Bar" },
    ];

    function closePanel() {
        dispatch("close");
    }
</script>

<div class="fixed bottom-16 right-4 z-50 flex flex-col items-end gap-2">
    {#if visible}
        <div
            class="bg-card border rounded-lg shadow-lg w-80 p-4"
            transition:fade={{ duration: 150 }}
        >
            <div class="flex justify-between items-center mb-3">
                <h3 class="font-medium">Keyboard Shortcuts</h3>
                <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 w-7 p-0"
                    onclick={closePanel}
                >
                    <X class="h-4 w-4" />
                </Button>
            </div>

            <div class="space-y-2">
                {#each shortcuts as shortcut}
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-muted-foreground"
                            >{shortcut.description}</span
                        >
                        <div class="flex items-center gap-1">
                            {#each shortcut.keys as key, i}
                                <kbd
                                    class="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100"
                                >
                                    <span class="text-xs">{key}</span>
                                </kbd>
                                {#if i < shortcut.keys.length - 1}
                                    <span class="text-muted-foreground">+</span>
                                {/if}
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>

            <div class="mt-3 text-xs text-muted-foreground">
                <p>
                    These are common keyboard shortcuts used throughout the
                    application.
                </p>
            </div>
        </div>
    {/if}
</div>

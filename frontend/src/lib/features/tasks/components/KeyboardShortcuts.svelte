<script lang="ts">
    import { fade, scale } from "svelte/transition";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Badge } from "$lib/components/ui/badge";
    import { Keyboard } from "lucide-svelte";

    let { open = $bindable(false) } = $props<{
        open?: boolean;
    }>();

    const shortcuts = [
        { key: "?", description: "Show this help" },
        { key: "n", description: "Create new task" },
        { key: "/", description: "Focus search" },
        { key: "c", description: "Toggle complete (when task selected)" },
        { key: "e", description: "Edit selected task" },
        { key: "Backspace", description: "Delete selected task" },
        { key: "Esc", description: "Clear selection / Close dialogs" },
        {
            key: "1-4",
            description: "Jump to category (Focus/Goals/Fit In/Backburner)",
        },
    ];
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="sm:max-w-[500px]">
        <Dialog.Header>
            <Dialog.Title class="flex items-center gap-2">
                <Keyboard class="h-5 w-5" />
                Keyboard Shortcuts
            </Dialog.Title>
            <Dialog.Description>
                Master these shortcuts to boost your productivity
            </Dialog.Description>
        </Dialog.Header>

        <div class="space-y-3 py-4">
            {#each shortcuts as shortcut}
                <div class="flex items-center justify-between gap-4 py-2">
                    <span class="text-sm text-muted-foreground flex-1">
                        {shortcut.description}
                    </span>
                    <Badge variant="outline" class="font-mono font-bold">
                        {shortcut.key}
                    </Badge>
                </div>
            {/each}
        </div>

        <Dialog.Footer>
            <p class="text-xs text-muted-foreground text-center w-full">
                Press <Badge variant="outline" class="mx-1">?</Badge> anytime to
                toggle this help
            </p>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

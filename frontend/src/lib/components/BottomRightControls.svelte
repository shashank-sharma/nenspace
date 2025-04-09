<script lang="ts">
    import { Keyboard } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { createEventDispatcher, onMount } from "svelte";
    import * as Tooltip from "$lib/components/ui/tooltip";
    import DebugLauncher from "./debug/DebugLauncher.svelte";

    const dispatch = createEventDispatcher<{
        "show-shortcuts": void;
    }>();

    function handleShortcutsClick() {
        dispatch("show-shortcuts");
    }
</script>

<div class="fixed bottom-4 right-16 z-50">
    <Tooltip.Root>
        <Tooltip.Trigger>
            <Button
                variant="primary"
                size="icon"
                on:click={handleShortcutsClick}
                aria-label="Show keyboard shortcuts"
                class="rounded-full h-10 w-10 p-0 shadow-md"
            >
                <Keyboard class="h-5 w-5" />
            </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>
            <p>Keyboard Shortcuts</p>
        </Tooltip.Content>
    </Tooltip.Root>
</div>

<style>
    @keyframes bounce {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-5px);
        }
    }

    .animate-bounce {
        animation: bounce 1s ease infinite;
    }
</style>

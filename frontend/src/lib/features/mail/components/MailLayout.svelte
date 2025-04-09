<script lang="ts">
    import { Nav } from "$lib/features/mail/components";
    import { Button } from "$lib/components/ui/button";
    import { Plus } from "lucide-svelte";
</script>

<div class="flex h-full">
    <aside
        class="w-64 h-full bg-white border-r border-gray-200 dark:bg-gray-800 dark:border-gray-700"
    >
        <div class="h-full flex flex-col">
            <div class="p-4">
                <Button class="w-full justify-start gap-2" variant="default">
                    <Plus class="h-4 w-4" />
                    <span>Compose</span>
                </Button>
            </div>
            <div class="flex-1 px-3 py-2 overflow-y-auto">
                <Nav />
            </div>
        </div>
    </aside>
    <main class="flex-1 h-full">
        <slot />
    </main>
</div>

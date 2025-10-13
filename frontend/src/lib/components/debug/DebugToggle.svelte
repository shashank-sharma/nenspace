<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import type { Snippet } from "svelte";

    let { label, icon, onClick } = $props<{
        label: string;
        icon: Snippet;
        onClick: () => void;
    }>();
</script>

<Button variant="ghost" class="w-full justify-start text-sm" onclick={onClick}>
    <div class="w-4 h-4 mr-2">
        {@render icon()}
    </div>
    {label}
</Button>

<style>
    /* No styles needed here as shadcn-svelte handles it */
</style>

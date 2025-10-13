<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { ArrowLeft } from "lucide-svelte";
    import type { Snippet } from "svelte";

    let {
        title,
        description = "",
        backLink = null,
        children,
    } = $props<{
        title: string;
        description?: string;
        backLink?: { href: string; label: string } | null;
        children: Snippet;
    }>();
</script>

<div class="p-4 sm:p-6">
    <header class="mb-4">
        {#if backLink}
            <a
                href={backLink.href}
                class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
            >
                <ArrowLeft class="w-4 h-4 mr-1" />
                {backLink.label}
            </a>
        {/if}
        <h1 class="text-2xl font-bold">{title}</h1>
        {#if description}
            <p class="text-muted-foreground mt-1">{description}</p>
        {/if}
    </header>

    <main>
        {@render children()}
    </main>
</div>

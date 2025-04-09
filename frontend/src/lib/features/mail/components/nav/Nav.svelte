<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { cn } from "$lib/utils";
    import { Inbox, Send, File, Trash2, Archive } from "lucide-svelte";
    import { page } from "$app/stores";

    const links = [
        {
            href: "/mail",
            label: "Inbox",
            icon: Inbox,
        },
        {
            href: "/mail/sent",
            label: "Sent",
            icon: Send,
        },
        {
            href: "/mail/drafts",
            label: "Drafts",
            icon: File,
        },
        {
            href: "/mail/trash",
            label: "Trash",
            icon: Trash2,
        },
        {
            href: "/mail/archive",
            label: "Archive",
            icon: Archive,
        },
    ];
</script>

<div class="flex flex-col gap-2">
    {#each links as link}
        <Button
            variant="ghost"
            class={cn(
                "w-full justify-start",
                $page.url.pathname === link.href && "bg-muted",
            )}
            href={link.href}
        >
            <svelte:component this={link.icon} class="mr-2 h-4 w-4" />
            {link.label}
        </Button>
    {/each}
</div>

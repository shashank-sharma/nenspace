<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import * as Command from "$lib/components/ui/command";
    import { goto } from "$app/navigation";
    import {
        LayoutDashboard,
        Server,
        Book,
        FileText,
        Palette,
        Package,
        Mail,
        Bookmark,
        DollarSign,
        CheckSquare,
    } from "lucide-svelte";

    let open = false;

    const sections = [
        { id: "", label: "Dashboard", icon: LayoutDashboard },
        { id: "servers", label: "Servers", icon: Server },
        { id: "notebooks", label: "Notebooks", icon: Book },
        { id: "posts", label: "Posts", icon: FileText },
        { id: "colors", label: "Colors", icon: Palette },
        { id: "inventory", label: "Inventory", icon: Package },
        { id: "newsletter", label: "Newsletter", icon: Mail },
        { id: "bookmarks", label: "Bookmarks", icon: Bookmark },
        { id: "expenses", label: "Expenses", icon: DollarSign },
        { id: "tasks", label: "Tasks", icon: CheckSquare },
    ];

    function navigateToSection(sectionId: string) {
        const path = sectionId ? `/dashboard/${sectionId}` : "/dashboard";
        goto(path);
        open = false;
    }

    onMount(() => {
        if (!browser) return;

        function handleKeydown(e: KeyboardEvent) {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                open = !open;
            }
        }

        document.addEventListener("keydown", handleKeydown);
        return () => {
            document.removeEventListener("keydown", handleKeydown);
        };
    });
</script>

<Command.Dialog bind:open>
    <Command.Input placeholder="Type a command or search sections..." />
    <Command.List>
        <Command.Empty>No results found.</Command.Empty>
        <Command.Group heading="Dashboard Sections">
            {#each sections as section}
                <Command.Item onSelect={() => navigateToSection(section.id)}>
                    <svelte:component
                        this={section.icon}
                        class="mr-2 h-4 w-4"
                    />
                    <span>{section.label}</span>
                </Command.Item>
            {/each}
        </Command.Group>
    </Command.List>
</Command.Dialog>

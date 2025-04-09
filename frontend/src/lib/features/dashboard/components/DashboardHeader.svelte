<script lang="ts">
    import { getContext } from "svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Search, Bell, Settings, Sun, Moon } from "lucide-svelte";
    import CommandPalette from "$lib/components/CommandPalette.svelte";
    import type { Writable } from "svelte/store";
    import NotificationCenter from "$lib/features/notifications/components/NotificationCenter.svelte";

    const { theme, toggleTheme } = getContext<{
        theme: Writable<"light" | "dark">;
        toggleTheme: () => void;
    }>("theme");

    // let showCommandPalette = true;
</script>

<header class="border-b bg-card">
    <div class="flex h-16 items-center px-4 gap-4">
        <div class="flex-1">
            <!-- <form class="max-w-sm">
                <div class="relative">
                    <Search
                        class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                    />
                    <Input
                        type="search"
                        placeholder="Search..."
                        class="pl-8"
                        on:focus={() => (showCommandPalette = true)}
                    />
                </div>
            </form> -->
        </div>

        <div class="flex items-center gap-2">
            <!-- <Button variant="ghost" size="icon" on:click={toggleTheme}>
                <svelte:component
                    this={$theme === "dark" ? Sun : Moon}
                    class="h-5 w-5"
                />
                <span class="sr-only">Toggle theme</span>
            </Button> -->

            <NotificationCenter />
        </div>
    </div>

    <CommandPalette />
</header>

<script lang="ts">
    import { browser } from "$app/environment";
    import { writable } from "svelte/store";
    import { Switch } from "$lib/components/ui/switch";
    import { Sun, Moon } from "lucide-svelte";

    // Local state for theme
    const theme = writable<string>(
        browser ? localStorage.getItem("theme") || "light" : "light",
    );

    // Track if it's dark theme
    let isDarkTheme = $theme === "dark";

    // Save theme to localStorage and apply it when it changes
    theme.subscribe((value) => {
        if (browser) {
            localStorage.setItem("theme", value);

            // Apply theme
            document.documentElement.classList.remove("dark", "light");

            if (value === "dark") {
                document.documentElement.classList.add("dark");
            } else {
                document.documentElement.classList.add("light");
            }
        }
    });

    // Handle theme toggle
    function toggleTheme(event: Event) {
        const isChecked = (event.target as HTMLInputElement).checked;
        isDarkTheme = isChecked;
        theme.set(isChecked ? "dark" : "light");
    }
</script>

<div class="space-y-3">
    <div class="flex items-center justify-between">
        <label for="theme-toggle" class="flex items-center text-sm gap-2">
            {#if isDarkTheme}
                <Moon size={16} class="text-indigo-400" />
                <span>Dark Mode</span>
            {:else}
                <Sun size={16} class="text-amber-400" />
                <span>Light Mode</span>
            {/if}
        </label>
        <Switch
            id="theme-toggle"
            checked={isDarkTheme}
            onCheckedChange={(checked) => {
                isDarkTheme = checked;
                theme.set(checked ? "dark" : "light");
            }}
        />
    </div>
</div>

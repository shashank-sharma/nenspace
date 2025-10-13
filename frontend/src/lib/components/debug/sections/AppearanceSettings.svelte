<script lang="ts">
    import { Switch } from "$lib/components/ui/switch";
    import { Sun, Moon } from "lucide-svelte";
    import { ThemeService } from "$lib/services/theme.service.svelte";
</script>

<div class="space-y-3">
    <div class="flex items-center justify-between">
        <label for="theme-toggle" class="flex items-center text-sm gap-2">
            {#if ThemeService.theme === "dark"}
                <Moon size={16} class="text-indigo-400" />
                <span>Dark Mode</span>
            {:else}
                <Sun size={16} class="text-amber-400" />
                <span>Light Mode</span>
            {/if}
        </label>
        <Switch
            id="theme-toggle"
            checked={ThemeService.theme === "dark"}
            onCheckedChange={ThemeService.toggleTheme}
        />
    </div>
</div>

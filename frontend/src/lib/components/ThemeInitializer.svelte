<script lang="ts">
    import { onMount } from "svelte";
    import { theme } from "$lib/stores/theme.store";

    onMount(() => {
        // Initialize theme on mount
        // The logic is now handled in the theme store
        const currentTheme = theme.getTheme();
        theme.setTheme(currentTheme);
    });
</script>

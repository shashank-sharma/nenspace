<!--
  SearchInput Component
  
  Reusable search input with clear button and icon.
  Eliminates ~30 lines of duplicate code per usage.
-->
<script lang="ts">
    import { Input } from "$lib/components/ui/input";
    import { Search, X } from "lucide-svelte";

    let {
        value = $bindable(""),
        placeholder = "Search...",
        class: className = "",
        disabled = false,
    } = $props<{
        value?: string;
        placeholder?: string;
        class?: string;
        disabled?: boolean;
    }>();

    function clearSearch() {
        value = "";
    }
</script>

<div class="relative {className}">
    <Search
        class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
    />
    <Input
        type="search"
        {placeholder}
        class="pl-10 pr-10"
        bind:value
        {disabled}
        aria-label={placeholder}
    />
    {#if value}
        <button
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 hover:bg-accent rounded p-1 transition-colors"
            onclick={clearSearch}
            {disabled}
            aria-label="Clear search"
        >
            <X class="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
    {/if}
</div>

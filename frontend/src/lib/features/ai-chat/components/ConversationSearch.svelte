
<script lang="ts">
    import SearchInput from '$lib/components/SearchInput.svelte';

    let {
        value = $bindable(""),
        placeholder = "Search conversations...",
        disabled = false,
    } = $props<{
        value?: string;
        placeholder?: string;
        disabled?: boolean;
    }>();
</script>

<SearchInput
    bind:value
    {placeholder}
    {disabled}
    class="w-full"
/>

<script lang="ts">
    let { label, value } = $props<{ label: string; value: string | boolean }>();
</script>

<div class="flex justify-between items-center text-sm">
    <span class="text-muted-foreground">{label}</span>
    {#if typeof value === "boolean"}
        <span class_={value ? "text-green-500" : "text-red-500"}>
            {value ? "✓ Supported" : "✗ Not Supported"}
        </span>
    {:else}
        <span>{value}</span>
    {/if}
</div>

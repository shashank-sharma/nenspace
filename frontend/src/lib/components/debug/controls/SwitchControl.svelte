<script lang="ts">
    import { Switch } from "$lib/components/ui/switch";
    import { Label } from "$lib/components/ui/label";

    let {
        label,
        checked = false,
        change,
        description,
    } = $props<{
        label: string;
        checked?: boolean;
        change?: (value: boolean) => void;
        description?: string;
    }>();
</script>

<div class="space-y-1">
    <div class="flex items-center justify-between">
        <Label class="cursor-pointer pr-4">{label}</Label>
        <Switch {checked} onCheckedChange={(v) => change?.(v)} />
    </div>
    {#if description}
        <p class="text-xs text-muted-foreground">{description}</p>
    {/if}
</div>

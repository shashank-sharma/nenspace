<script lang="ts">
    import {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue,
    } from "$lib/components/ui/select";
    import { Label } from "$lib/components/ui/label";

    type Option = { value: string; label: string };

    let { label, options, value, change } = $props<{
        label: string;
        options: Option[];
        value: string;
        change?: (value: string) => void;
    }>();
</script>

<div class="flex items-center justify-between">
    <Label class="pr-4">{label}</Label>
    <Select {value} onValueChange={(v: string | undefined) => v && change?.(v)}>
        <SelectTrigger class="w-auto min-w-[120px]">
            <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
            {#each options as option}
                <SelectItem value={option.value}>{option.label}</SelectItem>
            {/each}
        </SelectContent>
    </Select>
</div>

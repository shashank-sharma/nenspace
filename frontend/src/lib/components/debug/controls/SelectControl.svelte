<script lang="ts">
    import {
        Select,
        SelectTrigger,
        SelectValue,
        SelectContent,
        SelectItem,
    } from "$lib/components/ui/select";

    export let value: string;
    export let options: { label: string; value: string }[] = [];
    export let onChange: (value: string) => void = () => {};

    function handleChange(newValue: string) {
        value = newValue;
        onChange(newValue);
    }
</script>

<Select {value} onValueChange={handleChange}>
    <SelectTrigger class="w-full">
        <SelectValue placeholder="Select option" />
    </SelectTrigger>
    <SelectContent>
        {#each options as option}
            <SelectItem value={option.value}>{option.label}</SelectItem>
        {/each}
    </SelectContent>
</Select>

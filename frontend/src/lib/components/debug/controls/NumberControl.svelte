<script lang="ts">
    import { Input } from "$lib/components/ui/input";

    export let value: number;
    export let min: number | undefined = undefined;
    export let max: number | undefined = undefined;
    export let step: number = 1;
    export let onChange: (value: number) => void = () => {};

    function handleChange(event: Event) {
        const input = event.target as HTMLInputElement;
        const newValue = parseFloat(input.value);
        if (!isNaN(newValue)) {
            value = newValue;
            onChange(newValue);
        }
    }
</script>

<Input
    type="number"
    {value}
    {min}
    {max}
    {step}
    on:input={handleChange}
    class="w-full"
/>

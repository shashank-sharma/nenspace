<script lang="ts">
    import { Input } from "$lib/components/ui/input";

    let {
        value,
        min = undefined,
        max = undefined,
        step = 1,
        onChange = () => {},
    } = $props<{
        value: number;
        min?: number | undefined;
        max?: number | undefined;
        step?: number;
        onChange?: (value: number) => void;
    }>();

    function handleChange(event: Event) {
        const input = event.target as HTMLInputElement;
        const newValue = parseFloat(input.value);
        if (!isNaN(newValue)) {
            // Props are readonly, so we call the callback to update the parent's state.
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

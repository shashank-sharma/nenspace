<script lang="ts">
    import { Switch } from "$lib/components/ui/switch";

    let { value = false, onChange = () => {} } = $props<{
        value?: boolean;
        onChange?: (value: boolean) => void;
    }>();

    function handleChange(newValue: boolean) {
        // Props are readonly, so we call the callback to update the parent's state.
        onChange(newValue);
    }
</script>

<Switch checked={value} onCheckedChange={handleChange} />

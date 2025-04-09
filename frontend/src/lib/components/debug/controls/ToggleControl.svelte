<script lang="ts">
    import { Switch } from "$lib/components/ui/switch";

    export let value: boolean = false;
    export let onChange: (value: boolean) => void = () => {};

    function handleChange() {
        value = !value;
        onChange(value);
    }
</script>

<Switch checked={value} onCheckedChange={handleChange} />

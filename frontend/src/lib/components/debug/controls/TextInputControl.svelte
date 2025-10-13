<script lang="ts">
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";

    let {
        label,
        value,
        placeholder = "",
        update = (v: string) => {},
    } = $props<{
        label: string;
        value: string;
        placeholder?: string;
        update?: (value: string) => void;
    }>();
</script>

<div class="flex flex-col space-y-2">
    <Label>{label}</Label>
    <Input
        {placeholder}
        {value}
        oninput={(e) => update(e.currentTarget.value)}
    />
</div>

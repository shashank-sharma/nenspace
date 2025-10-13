<script lang="ts">
    import { Label } from "$lib/components/ui/label";
    import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";

    type Option = { value: string; label: string };

    let {
        label,
        options,
        value,
        change = (v: string) => {},
    } = $props<{
        label: string;
        options: Option[];
        value: string;
        change?: (value: string) => void;
    }>();
</script>

<div class="flex items-center justify-between">
    <Label class="pr-4">{label}</Label>
    <RadioGroup {value} onValueChange={(v) => v && change(v)}>
        <div class="flex items-center space-x-4">
            {#each options as option}
                <div class="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <Label for={option.value}>{option.label}</Label>
                </div>
            {/each}
        </div>
    </RadioGroup>
</div>

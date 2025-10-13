<script lang="ts">
    import { Button } from "$lib/components/ui/button";

    let {
        label,
        click,
        disabled = false,
    } = $props<{
        label: string;
        click?: () => void;
        disabled?: boolean;
    }>();
</script>

<Button
    variant="outline"
    size="sm"
    class="w-full justify-center"
    onclick={() => click?.()}
    {disabled}
>
    {label}
</Button>

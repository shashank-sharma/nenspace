<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Grid3x3, List, Calendar } from 'lucide-svelte';
    import * as Select from '$lib/components/ui/select';

    export type ViewMode = 'grid' | 'list' | 'timeline';

    let {
        value = $bindable(),
    } = $props<{
        value?: ViewMode;
    }>();

    const viewModes: { value: ViewMode; label: string; icon: typeof Grid3x3 }[] = [
        { value: 'grid', label: 'Grid', icon: Grid3x3 },
        { value: 'list', label: 'List', icon: List },
        { value: 'timeline', label: 'Timeline', icon: Calendar },
    ];

    const selectedMode = $derived(viewModes.find(m => m.value === value) || viewModes[0]);
</script>

<div class="flex items-center gap-2">
    <Select.Root
        selected={selectedMode}
        onSelectedChange={(val) => {
            if (val) {
                value = val.value;
            }
        }}
    >
        <Select.Trigger class="w-[120px]">
            <div class="flex items-center gap-2">
                <svelte:component this={selectedMode.icon} class="h-4 w-4" />
                <Select.Value>{selectedMode.label}</Select.Value>
            </div>
        </Select.Trigger>
        <Select.Content>
            {#each viewModes as mode}
                <Select.Item value={mode.value}>
                    <div class="flex items-center gap-2">
                        <svelte:component this={mode.icon} class="h-4 w-4" />
                        <span>{mode.label}</span>
                    </div>
                </Select.Item>
            {/each}
        </Select.Content>
    </Select.Root>
</div>


<script lang="ts">
    import { Root as SelectRoot, Trigger as SelectTrigger, Value as SelectValue, Content as SelectContent, Item as SelectItem } from '$lib/components/ui/select';
    import { Input } from '$lib/components/ui/input';
    import { Badge } from '$lib/components/ui/badge';
    import type { DataSchema } from '../types';
    import { workflowEditorStore } from '../stores';

    let { 
        schema, 
        value, 
        onValueChange, 
        placeholder = 'Select a field',
        allowCustom = false,
        customPlaceholder = 'Enter field name',
        showSource = true
    } = $props<{
        schema: DataSchema | null;
        value: string;
        onValueChange: (value: string) => void;
        placeholder?: string;
        allowCustom?: boolean;
        customPlaceholder?: string;
        showSource?: boolean;
    }>();

    // Helper to get node label from ID
    const getNodeLabel = (nodeId: string): string => {
        const node = workflowEditorStore.nodes.find(n => n.id === nodeId);
        return node?.data.label || nodeId.substring(0, 8);
    };

    const availableFields = $derived(() => {
        if (!schema || !schema.fields) return [];
        const hasMultipleSources = schema.source_nodes && schema.source_nodes.length > 1;
        
        return schema.fields.map(f => {
            let label = `${f.name} (${f.type})`;
            let sourceInfo = '';
            
            if (showSource && f.source_node) {
                const sourceLabel = getNodeLabel(f.source_node);
                sourceInfo = `from ${sourceLabel}`;
            } else if (showSource && hasMultipleSources) {
                // Field might be from merged sources
                sourceInfo = 'merged';
            }
            
            return {
                value: f.name,
                label: label,
                displayLabel: sourceInfo ? `${f.name} (${f.type}) - ${sourceInfo}` : label,
                type: f.type,
                sourceNode: f.source_node,
                description: f.description
            };
        });
    });

    const hasFields = $derived(availableFields().length > 0);
    const isCustomValue = $derived(hasFields && !availableFields().some(f => f.value === value));
    const hasMultipleSources = $derived(schema?.source_nodes && schema.source_nodes.length > 1);
</script>

{#if !hasFields && !allowCustom}
    <Input
        type="text"
        value={value || ''}
        on:input={(e) => onValueChange(e.currentTarget.value)}
        placeholder={customPlaceholder}
        class="h-8 text-xs"
    />
{:else if hasFields && !allowCustom}
    <SelectRoot
        selected={availableFields().find(f => f.value === value) || (value ? { value, label: value } : undefined)}
        onSelectedChange={(selected) => {
            if (selected) {
                onValueChange(selected.value);
            }
        }}
    >
        <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
            {#if hasMultipleSources()}
                <div class="px-2 py-1.5 text-xs text-muted-foreground border-b">
                    Fields from multiple sources
                </div>
            {/if}
            {#each availableFields() as field}
                <SelectItem value={field.value}>
                    <div class="flex items-center justify-between w-full">
                        <span>{field.label}</span>
                        {#if showSource && field.sourceNode}
                            <Badge variant="outline" class="ml-2 text-xs">
                                {getNodeLabel(field.sourceNode)}
                            </Badge>
                        {/if}
                    </div>
                    {#if field.description}
                        <div class="text-xs text-muted-foreground mt-0.5">{field.description}</div>
                    {/if}
                </SelectItem>
            {/each}
        </SelectContent>
    </SelectRoot>
{:else}
    <!-- Allow both dropdown and custom input -->
    <div class="space-y-1.5">
        <SelectRoot
            selected={availableFields().find(f => f.value === value) || (isCustomValue ? { value, label: value } : undefined)}
            onSelectedChange={(selected) => {
                if (selected) {
                    onValueChange(selected.value);
                }
            }}
        >
            <SelectTrigger class="h-8 text-xs">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {#if hasMultipleSources()}
                    <div class="px-2 py-1.5 text-xs text-muted-foreground border-b">
                        Fields from multiple sources
                    </div>
                {/if}
                {#each availableFields() as field}
                    <SelectItem value={field.value}>
                        <div class="flex items-center justify-between w-full">
                            <span>{field.label}</span>
                            {#if showSource && field.sourceNode}
                                <Badge variant="outline" class="ml-2 text-xs">
                                    {getNodeLabel(field.sourceNode)}
                                </Badge>
                            {/if}
                        </div>
                        {#if field.description}
                            <div class="text-xs text-muted-foreground mt-0.5">{field.description}</div>
                        {/if}
                    </SelectItem>
                {/each}
                {#if isCustomValue && value}
                    <SelectItem value={value}>{value} (custom)</SelectItem>
                {/if}
            </SelectContent>
        </SelectRoot>
        {#if isCustomValue || !value}
            <Input
                type="text"
                value={value || ''}
                on:input={(e) => onValueChange(e.currentTarget.value)}
                placeholder={customPlaceholder}
                class="h-8 text-xs"
            />
        {/if}
    </div>
{/if}


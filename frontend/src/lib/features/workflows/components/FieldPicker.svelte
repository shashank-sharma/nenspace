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
        
        // Group fields by source when multiple sources
        if (hasMultipleSources && showSource) {
            const grouped: Record<string, typeof schema.fields> = {};
            for (const field of schema.fields) {
                const sourceId = field.source_node || 'unknown';
                const sourceLabel = getNodeLabel(sourceId);
                if (!grouped[sourceLabel]) {
                    grouped[sourceLabel] = [];
                }
                grouped[sourceLabel].push(field);
            }
            
            // Return grouped fields with source labels
            const result: Array<{value: string, label: string, displayLabel: string, type: string, sourceNode: string | undefined, description: string | undefined, group?: string}> = [];
            for (const [sourceLabel, fields] of Object.entries(grouped)) {
                for (const f of fields) {
                    result.push({
                        value: f.name,
                        label: `${f.name} (${f.type})`,
                        displayLabel: `${f.name} (${f.type}) - from ${sourceLabel}`,
                        type: f.type,
                        sourceNode: f.source_node,
                        description: f.description,
                        group: sourceLabel
                    });
                }
            }
            return result;
        }
        
        // Single source or no grouping
        return schema.fields.map(f => {
            let label = `${f.name} (${f.type})`;
            let sourceInfo = '';
            
            if (showSource && f.source_node) {
                const sourceLabel = getNodeLabel(f.source_node);
                sourceInfo = `from ${sourceLabel}`;
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
                    Fields from {schema?.source_nodes?.length || 0} sources
                </div>
            {/if}
            {@const fields = availableFields()}
            {@const groupedFields = fields.reduce((acc, f) => {
                const group = (f as any).group || 'default';
                if (!acc[group]) acc[group] = [];
                acc[group].push(f);
                return acc;
            }, {} as Record<string, typeof fields>)}
            {#each Object.entries(groupedFields) as [groupName, groupFields]}
                {#if hasMultipleSources() && groupName !== 'default'}
                    <div class="px-2 py-1 text-xs font-medium text-muted-foreground bg-muted/50">
                        {groupName}
                    </div>
                {/if}
                {#each groupFields as field}
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
                        Fields from {schema?.source_nodes?.length || 0} sources
                    </div>
                {/if}
                {@const fields = availableFields()}
                {@const groupedFields = fields.reduce((acc, f) => {
                    const group = (f as any).group || 'default';
                    if (!acc[group]) acc[group] = [];
                    acc[group].push(f);
                    return acc;
                }, {} as Record<string, typeof fields>)}
                {#each Object.entries(groupedFields) as [groupName, groupFields]}
                    {#if hasMultipleSources() && groupName !== 'default'}
                        <div class="px-2 py-1 text-xs font-medium text-muted-foreground bg-muted/50">
                            {groupName}
                        </div>
                    {/if}
                    {#each groupFields as field}
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


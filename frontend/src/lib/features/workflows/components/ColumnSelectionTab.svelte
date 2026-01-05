<script lang="ts">
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import { X, GripVertical } from 'lucide-svelte';
    import type { DataSchema, FieldDefinition } from '../types';
    import { workflowEditorStore } from '../stores';
    import { getColorForNode, createColorMapping, type ColorInfo } from '../utils/color-utils';

    let {
        inputSchema,
        selectedColumns,
        onSelectedColumnsChange
    } = $props<{
        inputSchema: DataSchema | null;
        selectedColumns: string[];
        onSelectedColumnsChange: (columns: string[]) => void;
    }>();

    $effect(() => {
        if (inputSchema) {
            console.log('ColumnSelectionTab: Input schema received:', {
                fields: inputSchema.fields?.length || 0,
                sourceNodes: inputSchema.source_nodes?.length || 0,
                fieldsList: inputSchema.fields?.map(f => f.name) || []
            });
        } else {
            console.log('ColumnSelectionTab: No input schema');
        }
    });

    const getNodeLabel = (nodeId: string): string => {
        const node = workflowEditorStore.nodes.find(n => n.id === nodeId);
        return node?.data.label || nodeId.substring(0, 8);
    };

    const getCollectionName = (nodeId: string): string | null => {
        const node = workflowEditorStore.nodes.find(n => n.id === nodeId);
        if (!node) return null;

        const nodeType = node.data.nodeType?.toLowerCase() || '';
        const isPocketBase = nodeType === 'pocketbase_source' ||
                            nodeType === 'pocketbase' ||
                            nodeType.includes('pocketbase');

        if (isPocketBase && node.data.config?.collection) {
            return node.data.config.collection;
        }

        return null;
    };

    const colorMapping = $derived.by(() => {
        if (!inputSchema?.source_nodes) return new Map<string, ColorInfo>();
        return createColorMapping(inputSchema.source_nodes);
    });

    type FieldWithMetadata = {
        name: string;
        type: string;
        sourceNode: string;
        sourceNodeLabel: string;
        color: ColorInfo | null | undefined;
        nullable: boolean | undefined;
        description: string | undefined;
    };

    const groupedFields = $derived.by(() => {
        if (!inputSchema?.fields) return new Map<string, FieldDefinition[]>();

        const grouped = new Map<string, FieldDefinition[]>();
        for (const field of inputSchema.fields) {
            const sourceId = field.source_node || 'unknown';

            if (!grouped.has(sourceId)) {
                grouped.set(sourceId, []);
            }
            const fieldsArray = grouped.get(sourceId)!;
            fieldsArray.push(field);
        }
        return grouped;
    });

    const availableFields = $derived.by(() => {
        if (!inputSchema?.fields) return [] as FieldWithMetadata[];
        return inputSchema.fields.map(field => ({
            name: field.name,
            type: field.type,
            sourceNode: field.source_node || 'unknown',
            sourceNodeLabel: getNodeLabel(field.source_node || 'unknown'),
            color: field.source_node && colorMapping ? colorMapping.get(field.source_node) : null,
            nullable: field.nullable,
            description: field.description
        })) as FieldWithMetadata[];
    });

    let draggedColumn = $state<FieldWithMetadata | null>(null);
    let dragOverTarget = $state<string | null>(null);

    function handleDragStart(field: FieldWithMetadata, event: DragEvent) {
        draggedColumn = field;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', field.name);
        }
    }

    function handleDragOver(event: DragEvent, target: 'available' | 'selected') {
        event.preventDefault();
        event.dataTransfer!.dropEffect = 'move';
        dragOverTarget = target;
    }

    function handleDragLeave() {
        dragOverTarget = null;
    }

    function handleDrop(event: DragEvent, target: 'available' | 'selected') {
        event.preventDefault();
        dragOverTarget = null;

        if (!draggedColumn) return;

        if (target === 'selected') {

            if (!selectedColumns.includes(draggedColumn.name)) {
                onSelectedColumnsChange([...selectedColumns, draggedColumn.name]);
            }
        }

        draggedColumn = null;
    }

    function handleRemoveColumn(columnName: string) {
        onSelectedColumnsChange(selectedColumns.filter(c => c !== columnName));
    }

    function handleClickAdd(field: FieldWithMetadata) {
        if (!selectedColumns.includes(field.name)) {
            onSelectedColumnsChange([...selectedColumns, field.name]);
        }
    }

    const getFieldsForSource = (sourceLabel: string) => {
        return availableFields.filter(f => f.sourceNodeLabel === sourceLabel);
    };

    const isFieldSelected = (fieldName: string) => {
        return selectedColumns.includes(fieldName);
    };
</script>

<div class="space-y-4 h-full flex flex-col">

    <div class="flex items-center justify-between">
        <div>
            <h3 class="text-sm font-medium">Select Columns for Transformation</h3>
            <p class="text-xs text-muted-foreground">
                {#if inputSchema?.source_nodes && inputSchema.source_nodes.length > 0}
                    {inputSchema.source_nodes.length} data source{inputSchema.source_nodes.length !== 1 ? 's' : ''} connected
                {:else if inputSchema?.fields && inputSchema.fields.length > 0}
                    {@const uniqueSources = new Set(inputSchema.fields.map(f => f.source_node).filter(Boolean))}
                    {uniqueSources.size > 0
                        ? `${uniqueSources.size} data source${uniqueSources.size !== 1 ? 's' : ''} connected`
                        : 'Data source connected'}
                {:else}
                    No data sources connected
                {/if}
            </p>
        </div>
        {#if selectedColumns.length > 0}
            <Badge variant="secondary" class="text-xs">
                {selectedColumns.length} selected
            </Badge>
        {/if}
    </div>

    {#if !inputSchema || !inputSchema.fields || inputSchema.fields.length === 0}
        <div class="flex-1 flex items-center justify-center border border-dashed rounded-md">
            <div class="text-center p-4">
                <p class="text-sm text-muted-foreground">No columns available</p>
                <p class="text-xs text-muted-foreground mt-1">Connect a source node to see available columns</p>
            </div>
        </div>
    {:else}

        <div class="flex-1 grid grid-cols-2 gap-4 min-h-0">

            <div
                class="border rounded-md p-3 flex flex-col min-h-0 {dragOverTarget === 'available' ? 'border-primary bg-muted/30' : ''}"
                on:dragover={(e) => handleDragOver(e, 'available')}
                on:dragleave={handleDragLeave}
                on:drop={(e) => handleDrop(e, 'available')}
            >
                <div class="flex items-center justify-between mb-2 pb-2 border-b">
                    <h4 class="text-xs font-medium">Available Columns</h4>
                    <Badge variant="outline" class="text-xs">
                        {availableFields.length}
                    </Badge>
                </div>
                <div class="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                    {#each Array.from(groupedFields.entries()) as [sourceId, fields]}
                        {@const sourceLabel = getNodeLabel(sourceId)}
                        {@const color = colorMapping ? colorMapping.get(sourceId) : null}
                        {@const collectionName = getCollectionName(sourceId)}
                        <div class="space-y-2 border rounded-md p-2 bg-muted/20">
                            <div class="flex items-center gap-2 pb-2 border-b">
                                <div
                                    class="w-3 h-3 rounded-full flex-shrink-0 {color?.bg || 'bg-gray-400'}"
                                    title={sourceLabel}
                                ></div>
                                <div class="flex-1 min-w-0">
                                    <h5 class="text-xs font-medium truncate">{sourceLabel}</h5>
                                    {#if collectionName}
                                        <p class="text-[10px] text-muted-foreground truncate mt-0.5">
                                            Table: {collectionName}
                                        </p>
                                    {/if}
                                </div>
                                <Badge variant="outline" class="text-[10px] flex-shrink-0">
                                    {fields.length}
                                </Badge>
                            </div>
                            <div class="space-y-1.5 pl-1">
                                {#each fields as field}
                                    {@const isSelected = isFieldSelected(field.name)}
                                    <div
                                        draggable="true"
                                        class="flex items-center gap-2 p-2 rounded border cursor-move hover:bg-muted/50 transition-colors {isSelected ? 'opacity-50 border-primary bg-primary/5' : ''}"
                                        on:dragstart={(e) => handleDragStart({
                                            name: field.name,
                                            type: field.type,
                                            sourceNode: field.source_node || 'unknown',
                                            sourceNodeLabel: getNodeLabel(field.source_node || 'unknown'),
                                            color: color,
                                            nullable: field.nullable,
                                            description: field.description
                                        }, e)}
                                        on:click={() => !isSelected && handleClickAdd({
                                            name: field.name,
                                            type: field.type,
                                            sourceNode: field.source_node || 'unknown',
                                            sourceNodeLabel: getNodeLabel(field.source_node || 'unknown'),
                                            color: color,
                                            nullable: field.nullable,
                                            description: field.description
                                        })}
                                        role="button"
                                        tabindex="0"
                                    >
                                        <GripVertical class="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2">
                                                <span class="text-xs font-medium truncate">{field.name}</span>
                                                <Badge variant="outline" class="text-[10px] px-1 py-0">
                                                    {field.type}
                                                </Badge>
                                            </div>
                                            {#if field.description}
                                                <p class="text-[10px] text-muted-foreground truncate mt-0.5">
                                                    {field.description}
                                                </p>
                                            {/if}
                                        </div>
                                        {#if isSelected}
                                            <Badge variant="secondary" class="text-[10px]">Selected</Badge>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>

            <div
                class="border rounded-md p-3 flex flex-col min-h-0 {dragOverTarget === 'selected' ? 'border-primary bg-primary/5' : ''}"
                on:dragover={(e) => handleDragOver(e, 'selected')}
                on:dragleave={handleDragLeave}
                on:drop={(e) => handleDrop(e, 'selected')}
            >
                <div class="flex items-center justify-between mb-2 pb-2 border-b">
                    <h4 class="text-xs font-medium">Selected Columns</h4>
                    <Badge variant="secondary" class="text-xs">
                        {selectedColumns.length}
                    </Badge>
                </div>
                <div class="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                    {#if selectedColumns.length === 0}
                        <div class="flex-1 flex items-center justify-center border border-dashed rounded-md">
                            <div class="text-center p-4">
                                <p class="text-xs text-muted-foreground">No columns selected</p>
                                <p class="text-[10px] text-muted-foreground mt-1">
                                    Drag columns here or click to add
                                </p>
                            </div>
                        </div>
                    {:else}
                        {#each selectedColumns as columnName}
                            {@const field = availableFields.find(f => f.name === columnName)}
                            {#if field}
                                <div class="flex items-center gap-2 p-2 rounded border bg-card">
                                    <div
                                        class="w-2 h-2 rounded-full {field.color?.bg || 'bg-gray-400'} flex-shrink-0"
                                        title={field.sourceNodeLabel}
                                    ></div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs font-medium truncate">{field.name}</span>
                                            <Badge variant="outline" class="text-[10px] px-1 py-0">
                                                {field.type}
                                            </Badge>
                                        </div>
                                        <p class="text-[10px] text-muted-foreground truncate">
                                            from {field.sourceNodeLabel}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="h-5 w-5 flex-shrink-0"
                                        on:click={() => handleRemoveColumn(columnName)}
                                        title="Remove column"
                                    >
                                        <X class="h-3 w-3" />
                                    </Button>
                                </div>
                            {/if}
                        {/each}
                    {/if}
                </div>
            </div>
        </div>

        {#if selectedColumns.length === 0}
            <div class="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
                Select at least one column to proceed to transformations
            </div>
        {/if}
    {/if}
</div>

<style>
    .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: hsl(var(--muted-foreground) / 0.5) hsl(var(--muted) / 0.2);
    }

    .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
    }

    .custom-scrollbar::-webkit-scrollbar-track {
        background: hsl(var(--muted) / 0.12);
        border-radius: 4px;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: hsl(var(--muted-foreground) / 0.45);
        border-radius: 4px;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: hsl(var(--muted-foreground) / 0.6);
    }
</style>


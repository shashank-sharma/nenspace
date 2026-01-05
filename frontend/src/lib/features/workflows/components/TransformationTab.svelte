<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Root as SelectRoot, Trigger as SelectTrigger, Value as SelectValue, Content as SelectContent, Item as SelectItem } from '$lib/components/ui/select';
    import { Plus, Trash2, GripVertical } from 'lucide-svelte';
    import { Badge } from '$lib/components/ui/badge';
    import type { FlowNode, DataSchema } from '../types';
    import { workflowEditorStore } from '../stores';
    import FieldPicker from './FieldPicker.svelte';
    import { validateFieldReference } from '../utils';
    import { getColorForNode } from '../utils/color-utils';

    let {
        node,
        inputSchema,
        selectedColumns,
        transformations,
        onTransformationsChange
    } = $props<{
        node: FlowNode;
        inputSchema: DataSchema | null;
        selectedColumns: string[];
        transformations: Array<Record<string, any>>;
        onTransformationsChange: (transformations: Array<Record<string, any>>) => void;
    }>();

    const filteredInputSchema = $derived(() => {
        if (!inputSchema) return null;
        if (selectedColumns.length === 0) return inputSchema;

        return {
            ...inputSchema,
            fields: inputSchema.fields.filter(f => selectedColumns.includes(f.name))
        };
    });

    const transformationTypes = [
        { value: 'rename', label: 'Rename Field' },
        { value: 'delete', label: 'Delete Field' },
        { value: 'add', label: 'Add Field' },
        { value: 'modify', label: 'Modify Field' },
        { value: 'cast', label: 'Cast Type' },
        { value: 'copy', label: 'Copy Field' },
        { value: 'lowercase', label: 'Lowercase' },
        { value: 'uppercase', label: 'Uppercase' },
        { value: 'trim', label: 'Trim Whitespace' },
        { value: 'replace', label: 'Replace Text' },
        { value: 'concat', label: 'Concatenate Fields' },
        { value: 'split', label: 'Split Field' },
        { value: 'format_date', label: 'Format Date' },
        { value: 'parse_date', label: 'Parse Date' },
    ];

    const castTypes = [
        { value: 'string', label: 'String' },
        { value: 'number', label: 'Number' },
        { value: 'boolean', label: 'Boolean' },
        { value: 'date', label: 'Date' },
    ];

    function getTransformationsArray(): Array<Record<string, any>> {
        if (!transformations) return [];
        if (Array.isArray(transformations)) return transformations;
        if (typeof transformations === 'object') return [transformations];
        return [];
    }

    function addTransformation(type: string = 'rename') {
        const current = getTransformationsArray();
        onTransformationsChange([...current, { type }]);
    }

    function removeTransformation(index: number) {
        const current = getTransformationsArray();
        onTransformationsChange(current.filter((_, i) => i !== index));
    }

    function updateTransformation(index: number, field: string, value: any) {
        const current = getTransformationsArray();
        onTransformationsChange(current.map((t, i) => {
            if (i === index) {
                const updated = { ...t };
                if (value === undefined || value === null || value === '') {
                    delete updated[field];
                } else {
                    updated[field] = value;
                }
                return updated;
            }
            return t;
        }));
    }

    function getRequiredFields(type: string): string[] {
        switch (type) {
            case 'rename':
            case 'copy':
            case 'split':
                return ['sourceField', 'targetField'];
            case 'delete':
            case 'lowercase':
            case 'uppercase':
            case 'trim':
                return ['sourceField'];
            case 'add':
                return ['targetField'];
            case 'modify':
            case 'cast':
                return ['sourceField'];
            case 'replace':
                return ['sourceField', 'oldValue', 'newValue'];
            case 'concat':
                return ['sourceField'];
            case 'format_date':
            case 'parse_date':
                return ['sourceField'];
            default:
                return [];
        }
    }

    function needsTargetField(type: string): boolean {
        return ['rename', 'copy', 'split', 'add', 'cast', 'concat', 'format_date', 'parse_date'].includes(type);
    }

    function needsValue(type: string): boolean {
        return ['add', 'modify'].includes(type);
    }

    function needsExpression(type: string): boolean {
        return ['add', 'modify'].includes(type);
    }

    function needsToType(type: string): boolean {
        return type === 'cast';
    }

    function needsOldNewValue(type: string): boolean {
        return type === 'replace';
    }

    function needsSeparator(type: string): boolean {
        return ['concat', 'split'].includes(type);
    }

    function needsDateFormat(type: string): boolean {
        return ['format_date', 'parse_date'].includes(type);
    }

    function getValidationWarnings(transformation: Record<string, any>, index: number): string[] {
        const warnings: string[] = [];
        const type = transformation.type;

        if (!type) return warnings;

        const requiredFields = getRequiredFields(type);
        for (const field of requiredFields) {
            if (!transformation[field] || transformation[field] === '') {
                warnings.push(`Missing required field: ${field}`);
            }
        }

        if (transformation.sourceField) {
            const validation = validateFieldReference(inputSchema, transformation.sourceField);
            if (!validation.valid && validation.error) {
                warnings.push(validation.error);
            }
        }

        if (type === 'cast' && !transformation.toType) {
            warnings.push('Target type is required for cast operation');
        }

        if (type === 'replace' && (!transformation.oldValue || !transformation.newValue)) {
            warnings.push('Both old value and new value are required for replace');
        }

        return warnings;
    }

    const outputSchemaPreview = $derived(() => {
        if (!inputSchema || !transformations || transformations.length === 0) {
            return inputSchema;
        }

        const fields = new Map<string, { name: string; type: string; sourceNode?: string }>();

        inputSchema.fields.forEach(field => {
            fields.set(field.name, {
                name: field.name,
                type: field.type,
                sourceNode: field.source_node
            });
        });

        getTransformationsArray().forEach(transformation => {
            const type = transformation.type;
            const sourceField = transformation.sourceField;
            const targetField = transformation.targetField;

            switch (type) {
                case 'rename':
                    if (sourceField && targetField && fields.has(sourceField)) {
                        const field = fields.get(sourceField)!;
                        fields.delete(sourceField);
                        fields.set(targetField, { ...field, name: targetField });
                    }
                    break;
                case 'delete':
                    if (sourceField) {
                        fields.delete(sourceField);
                    }
                    break;
                case 'add':
                    if (targetField) {
                        fields.set(targetField, {
                            name: targetField,
                            type: 'string',
                            sourceNode: undefined
                        });
                    }
                    break;
                case 'cast':
                    if (sourceField && fields.has(sourceField) && transformation.toType) {
                        const field = fields.get(sourceField)!;
                        fields.set(sourceField, { ...field, type: transformation.toType });
                    }
                    break;
                case 'copy':
                    if (sourceField && targetField && fields.has(sourceField)) {
                        const field = fields.get(sourceField)!;
                        fields.set(targetField, { ...field, name: targetField });
                    }
                    break;
            }
        });

        return {
            ...inputSchema,
            fields: Array.from(fields.values()).map(f => ({
                name: f.name,
                type: f.type as any,
                source_node: f.sourceNode,
                nullable: true,
                description: undefined
            }))
        };
    });

    const getNodeLabel = (nodeId: string): string => {
        const node = workflowEditorStore.nodes.find(n => n.id === nodeId);
        return node?.data.label || nodeId.substring(0, 8);
    };
</script>

<div class="space-y-4 h-full flex flex-col">

    <div class="flex items-center justify-between">
        <div>
            <h3 class="text-sm font-medium">Configure Transformations</h3>
            <p class="text-xs text-muted-foreground">
                Transform selected columns
            </p>
        </div>
        <Button
            variant="outline"
            size="sm"
            on:click={() => addTransformation()}
            class="h-7 text-xs"
            disabled={selectedColumns.length === 0}
        >
            <Plus class="h-3 w-3 mr-1" />
            Add Transformation
        </Button>
    </div>

    {#if selectedColumns.length === 0}
        <div class="flex-1 flex items-center justify-center border border-dashed rounded-md">
            <div class="text-center p-4">
                <p class="text-sm text-muted-foreground">No columns selected</p>
                <p class="text-xs text-muted-foreground mt-1">Go back to Column Selection tab to select columns</p>
            </div>
        </div>
    {:else}

        <div class="border rounded-md p-2 bg-muted/30">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-medium">Selected Columns:</span>
                {#each selectedColumns as columnName}
                    {@const field = inputSchema?.fields.find(f => f.name === columnName)}
                    {#if field}
                        <Badge variant="secondary" class="text-xs">
                            {field.name} ({field.type})
                        </Badge>
                    {:else}
                        <Badge variant="secondary" class="text-xs">
                            {columnName}
                        </Badge>
                    {/if}
                {/each}
            </div>
        </div>

        <div class="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
            {#if getTransformationsArray().length === 0}
                <div class="flex items-center justify-center border border-dashed rounded-md p-8">
                    <div class="text-center">
                        <p class="text-sm text-muted-foreground">No transformations added</p>
                        <p class="text-xs text-muted-foreground mt-1">Click "Add Transformation" to get started</p>
                    </div>
                </div>
            {:else}
                {#each getTransformationsArray() as transformation, index}
                    <div class="border rounded-md p-3 space-y-2 bg-card">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex items-center gap-2 flex-1">
                                <GripVertical class="h-4 w-4 text-muted-foreground" />
                                <span class="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-6 w-6"
                                on:click={() => removeTransformation(index)}
                            >
                                <Trash2 class="h-3 w-3" />
                            </Button>
                        </div>

                        <div class="space-y-1.5">
                            <Label class="text-xs">
                                Type
                                <span class="text-destructive">*</span>
                            </Label>
                            <SelectRoot
                                selected={transformationTypes.find(t => t.value === transformation.type) || transformationTypes[0]}
                                onSelectedChange={(selected) => {
                                    if (selected) {
                                        updateTransformation(index, 'type', selected.value);
                                    }
                                }}
                            >
                                <SelectTrigger class="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {#each transformationTypes as type}
                                        <SelectItem value={type.value}>{type.label}</SelectItem>
                                    {/each}
                                </SelectContent>
                            </SelectRoot>
                        </div>

                        {#if getValidationWarnings(transformation, index).length > 0}
                            <div class="space-y-1">
                                {#each getValidationWarnings(transformation, index) as warning}
                                    <div class="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-1.5">
                                        {warning}
                                    </div>
                                {/each}
                            </div>
                        {/if}

                        <!-- Source Field -->
                        {#if getRequiredFields(transformation.type || '').includes('sourceField')}
                            <div class="space-y-1.5">
                                <Label class="text-xs">
                                    Source Field
                                    <span class="text-destructive">*</span>
                                </Label>
                                {#if filteredInputSchema && filteredInputSchema.fields && filteredInputSchema.fields.length > 0}
                                    <FieldPicker
                                        schema={filteredInputSchema}
                                        value={transformation.sourceField || ''}
                                        onValueChange={(value) => updateTransformation(index, 'sourceField', value)}
                                        placeholder="Select source field"
                                        allowCustom={true}
                                        customPlaceholder="Or enter field name"
                                        showSource={true}
                                    />
                                {:else}
                                    <Input
                                        type="text"
                                        value={transformation.sourceField || ''}
                                        on:input={(e) => updateTransformation(index, 'sourceField', e.currentTarget.value)}
                                        placeholder="e.g., email, name, age"
                                        class="h-8 text-xs"
                                    />
                                {/if}
                            </div>
                        {/if}

                        <!-- Target Field -->
                        {#if needsTargetField(transformation.type || '')}
                            <div class="space-y-1.5">
                                <Label class="text-xs">
                                    Target Field
                                    {#if getRequiredFields(transformation.type || '').includes('targetField')}
                                        <span class="text-destructive">*</span>
                                    {/if}
                                </Label>
                                <Input
                                    type="text"
                                    value={transformation.targetField || ''}
                                    on:input={(e) => updateTransformation(index, 'targetField', e.currentTarget.value)}
                                    placeholder="e.g., new_field_name"
                                    class="h-8 text-xs"
                                />
                            </div>
                        {/if}

                        <!-- Value -->
                        {#if needsValue(transformation.type || '')}
                            <div class="space-y-1.5">
                                <Label class="text-xs">Value</Label>
                                <Input
                                    type="text"
                                    value={transformation.value || ''}
                                    on:input={(e) => updateTransformation(index, 'value', e.currentTarget.value)}
                                    placeholder="Static value to set"
                                    class="h-8 text-xs"
                                />
                            </div>
                        {/if}

                        <!-- Expression -->
                        {#if needsExpression(transformation.type || '')}
                            <div class="space-y-1.5">
                                <Label class="text-xs">Expression</Label>
                                <Input
                                    type="text"
                                    value={transformation.expression || ''}
                                    on:input={(e) => updateTransformation(index, 'expression', e.currentTarget.value)}
                                    placeholder="e.g., ${field1} + ${field2}"
                                    class="h-8 text-xs"
                                />
                                <p class="text-xs text-muted-foreground">
                                    Use ${fieldName} to reference other fields
                                </p>
                            </div>
                        {/if}

                        <!-- To Type (for cast) -->
                        {#if needsToType(transformation.type || '')}
                            <div class="space-y-1.5">
                                <Label class="text-xs">
                                    Target Type
                                    <span class="text-destructive">*</span>
                                </Label>
                                <SelectRoot
                                    selected={castTypes.find(t => t.value === transformation.toType) || castTypes[0]}
                                    onSelectedChange={(selected) => {
                                        if (selected) {
                                            updateTransformation(index, 'toType', selected.value);
                                        }
                                    }}
                                >
                                    <SelectTrigger class="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {#each castTypes as type}
                                            <SelectItem value={type.value}>{type.label}</SelectItem>
                                        {/each}
                                    </SelectContent>
                                </SelectRoot>
                            </div>
                        {/if}

                        <!-- Old Value / New Value (for replace) -->
                        {#if needsOldNewValue(transformation.type || '')}
                            <div class="grid grid-cols-2 gap-2">
                                <div class="space-y-1.5">
                                    <Label class="text-xs">
                                        Old Value
                                        <span class="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        type="text"
                                        value={transformation.oldValue || ''}
                                        on:input={(e) => updateTransformation(index, 'oldValue', e.currentTarget.value)}
                                        placeholder="Text to replace"
                                        class="h-8 text-xs"
                                    />
                                </div>
                                <div class="space-y-1.5">
                                    <Label class="text-xs">
                                        New Value
                                        <span class="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        type="text"
                                        value={transformation.newValue || ''}
                                        on:input={(e) => updateTransformation(index, 'newValue', e.currentTarget.value)}
                                        placeholder="Replacement text"
                                        class="h-8 text-xs"
                                    />
                                </div>
                            </div>
                        {/if}

                        <!-- Separator (for concat/split) -->
                        {#if needsSeparator(transformation.type || '')}
                            <div class="space-y-1.5">
                                <Label class="text-xs">Separator</Label>
                                <Input
                                    type="text"
                                    value={transformation.separator || ','}
                                    on:input={(e) => updateTransformation(index, 'separator', e.currentTarget.value)}
                                    placeholder=","
                                    class="h-8 text-xs"
                                />
                            </div>
                        {/if}

                        <!-- Date Format (for date operations) -->
                        {#if needsDateFormat(transformation.type || '')}
                            <div class="space-y-1.5">
                                <Label class="text-xs">Date Format</Label>
                                <Input
                                    type="text"
                                    value={transformation.dateFormat || '2006-01-02'}
                                    on:input={(e) => updateTransformation(index, 'dateFormat', e.currentTarget.value)}
                                    placeholder="2006-01-02"
                                    class="h-8 text-xs"
                                />
                                <p class="text-xs text-muted-foreground">
                                    Go date format (e.g., 2006-01-02 for YYYY-MM-DD)
                                </p>
                            </div>
                        {/if}
                    </div>
                {/each}
            {/if}
        </div>

        {#if outputSchemaPreview && getTransformationsArray().length > 0}
            <div class="border-t pt-3 mt-3">
                <h4 class="text-xs font-medium mb-2">Schema Preview</h4>
                <div class="space-y-1 text-xs">
                    {#each outputSchemaPreview.fields as field}
                        <div class="flex items-center gap-2 p-1.5 rounded bg-muted/30">
                            <span class="font-medium">{field.name}</span>
                            <Badge variant="outline" class="text-[10px]">{field.type}</Badge>
                            {#if field.source_node}
                                <span class="text-muted-foreground text-[10px]">
                                    from {getNodeLabel(field.source_node)}
                                </span>
                            {/if}
                        </div>
                    {/each}
                </div>
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


<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Root as SelectRoot, Trigger as SelectTrigger, Value as SelectValue, Content as SelectContent, Item as SelectItem } from '$lib/components/ui/select';
    import { Plus, Trash2, GripVertical, Eye, Zap } from 'lucide-svelte';
    import { Badge } from '$lib/components/ui/badge';
    import type { FlowNode, DataSchema, DataEnvelope } from '../types';
    import { workflowEditorStore } from '../stores';
    import FieldPicker from './FieldPicker.svelte';
    import { applyTransformationsToSample, validateFieldReference } from '../utils';

    let { node } = $props<{ node: FlowNode }>();

    // Get input schema (what flows INTO this node from upstream)
    // This is what we use for field pickers - shows fields available to transform
    const inputSchema = $derived(workflowEditorStore.getNodeInputSchema(node.id));
    
    // Get input sample data (what flows INTO this node from upstream)
    // This is what we use for preview - shows data before this node's transformations
    const inputSampleData = $derived(workflowEditorStore.getNodeInputSampleData(node.id));
    
    // Get output schema (what flows OUT OF this node after transformations)
    // This is what the node produces - includes all transformations from the chain
    const outputSchema = $derived(workflowEditorStore.getNodeOutputSchema(node.id));
    
    const isLoadingSchema = $derived(workflowEditorStore.loadingSchema.get(node.id) || false);

    // Preview state
    let showPreview = $state(false);
    let previewData = $state<Array<Record<string, any>>>([]);
    let previewError = $state<string | null>(null);

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

    // Initialize transformations as empty array - will be populated by effect
    let transformations = $state<Array<Record<string, any>>>([]);

    // Check if node has upstream connections
    const hasUpstreamConnections = $derived(workflowEditorStore.edges.some(e => e.target === node.id));
    
    // Check if node is saved (not a temporary ID)
    const isNodeSaved = $derived(() => {
        // Temporary IDs follow pattern: node_<timestamp>_<random>
        return !/^node_\d+_[a-z0-9]+$/i.test(node.id);
    });

    // Fetch schema when node changes (only if there are upstream connections)
    $effect(() => {
        if (node && workflowEditorStore.workflowId && isNodeSaved) {
            // Only fetch if there are upstream connections
            if (hasUpstreamConnections) {
                // Find upstream nodes and fetch their schemas first
                const upstreamNodeIds = workflowEditorStore.edges
                    .filter(e => e.target === node.id)
                    .map(e => e.source);
                
                // Fetch upstream schemas first (especially source nodes)
                for (const upstreamId of upstreamNodeIds) {
                    if (!workflowEditorStore.isTemporaryNodeId?.(upstreamId)) {
                        workflowEditorStore.fetchNodeSchemaAndSample(upstreamId);
                    }
                }
                
                // Then fetch this node's schema
                workflowEditorStore.fetchNodeSchemaAndSample(node.id);
            } else {
                // Clear cached data if no upstream connections
                workflowEditorStore.nodeSchemas.delete(node.id);
                workflowEditorStore.nodeSampleData.delete(node.id);
            }
        }
    });
    
    // Watch for when upstream schemas become available and update input schema
    // This handles the case where source schema is fetched after processor node is selected
    $effect(() => {
        if (node && workflowEditorStore.workflowId && hasUpstreamConnections && isNodeSaved) {
            const upstreamNodeIds = workflowEditorStore.edges
                .filter(e => e.target === node.id)
                .map(e => e.source);
            
            // Check if upstream schemas are available
            const upstreamSchemas = upstreamNodeIds
                .map(id => workflowEditorStore.nodeSchemas.get(id))
                .filter(Boolean);
            
            // If we have upstream schemas but no input schema, the getNodeInputSchema should return it
            // But if it's still null, trigger a refetch
            if (upstreamSchemas.length > 0 && !inputSchema && !isLoadingSchema) {
                // Small delay to ensure reactive updates have propagated
                setTimeout(() => {
                    // Check again - if still no schema, it might be a timing issue
                    const currentInputSchema = workflowEditorStore.getNodeInputSchema(node.id);
                    if (!currentInputSchema) {
                        // Force refetch of processor node to get updated schema
                        workflowEditorStore.fetchNodeSchemaAndSample(node.id);
                    }
                }, 200);
            }
        }
    });

    // Use a function to safely get transformations as an array
    function getTransformationsArray(): Array<Record<string, any>> {
        try {
            if (!transformations) return [];
            if (Array.isArray(transformations)) return transformations;
            if (typeof transformations === 'object') return [transformations];
            return [];
        } catch (error) {
            console.error('Error getting transformations array:', error);
            return [];
        }
    }

    // Update from node config when node changes
    $effect(() => {
        if (node) {
            const config = node.data.config || {};
            const configTransformations = config.transformations;
            
            // Ensure it's an array - handle both array and non-array cases
            if (Array.isArray(configTransformations)) {
                transformations = configTransformations.map(t => ({ ...t }));
            } else if (configTransformations) {
                // If it's not an array but exists, wrap it
                transformations = [configTransformations];
            } else {
                transformations = [];
            }
        } else {
            transformations = [];
        }
    });

    function updateTransformations() {
        if (!node) return;
        
        // Ensure transformations is an array before updating
        const transformationsArray = Array.isArray(transformations) ? transformations : [];
        
        workflowEditorStore.updateNode(node.id, {
            data: {
                ...node.data,
                config: {
                    ...node.data.config,
                    transformations: transformationsArray
                }
            }
        });
    }

    function addTransformation(type: string = 'rename') {
        try {
            // Get current transformations as a safe array
            const current = getTransformationsArray();
            
            // Create a new array with the new transformation
            transformations = [...current, { type }];
            updateTransformations();
        } catch (error) {
            console.error('Error adding transformation:', error, transformations);
            // Fallback: just set a new array with one transformation
            transformations = [{ type }];
            updateTransformations();
        }
    }

    // Quick action templates for common transformations
    function addQuickTransformation(template: string) {
        const current = getTransformationsArray();
        let newTransformation: Record<string, any> = {};
        
        switch (template) {
            case 'rename_all':
                // Add rename transformations for all fields (user can customize)
                if (inputSchema && inputSchema.fields.length > 0) {
                    const newTransformations = inputSchema.fields.slice(0, 5).map(field => ({
                        type: 'rename',
                        sourceField: field.name,
                        targetField: field.name // User can change this
                    }));
                    transformations = [...current, ...newTransformations];
                }
                break;
            case 'lowercase_all_strings':
                if (inputSchema && inputSchema.fields.length > 0) {
                    const newTransformations = inputSchema.fields
                        .filter(f => f.type === 'string')
                        .slice(0, 5)
                        .map(field => ({
                            type: 'lowercase',
                            sourceField: field.name
                        }));
                    transformations = [...current, ...newTransformations];
                }
                break;
            case 'delete_system_fields':
                // Common system field names to delete
                const systemFields = ['id', 'created', 'updated', 'collectionId', 'collectionName'];
                if (inputSchema && inputSchema.fields.length > 0) {
                    const fieldsToDelete = inputSchema.fields
                        .filter(f => systemFields.includes(f.name.toLowerCase()))
                        .map(field => ({
                            type: 'delete',
                            sourceField: field.name
                        }));
                    transformations = [...current, ...fieldsToDelete];
                }
                break;
            default:
                newTransformation = { type: template };
                transformations = [...current, newTransformation];
        }
        
        updateTransformations();
    }

    function removeTransformation(index: number) {
        // Create a new array without the item at index
        const current = getTransformationsArray();
        transformations = current.filter((_, i) => i !== index);
        updateTransformations();
        
        // Regenerate preview if showing
        if (showPreview) {
            setTimeout(() => generatePreview(), 50);
        }
    }

    function updateTransformation(index: number, field: string, value: any) {
        // Create a new array with updated transformation
        const current = getTransformationsArray();
        transformations = current.map((t, i) => {
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
        });
        updateTransformations();
        
        // Regenerate preview if showing
        if (showPreview) {
            setTimeout(() => generatePreview(), 50);
        }
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

    // Preview transformation logic using shared utilities
    function generatePreview() {
        if (!inputSampleData) {
            previewError = 'No sample data available. Connect a source node first.';
            previewData = [];
            return;
        }

        const current = getTransformationsArray();
        const result = applyTransformationsToSample(inputSampleData, current);
        previewData = result.data;
        previewError = result.error;
    }

    // Auto-generate preview when transformations or sample data changes
    $effect(() => {
        if (showPreview && inputSampleData) {
            // Use a small delay to ensure transformations state is updated
            setTimeout(() => {
                generatePreview();
            }, 100);
        }
    });

    // Validation warnings
    function getValidationWarnings(transformation: Record<string, any>, index: number): string[] {
        const warnings: string[] = [];
        const type = transformation.type;
        
        if (!type) return warnings;

        // Check required fields
        const requiredFields = getRequiredFields(type);
        for (const field of requiredFields) {
            if (!transformation[field] || transformation[field] === '') {
                warnings.push(`Missing required field: ${field}`);
            }
        }

        // Check if source field exists in schema using shared utility
        if (transformation.sourceField) {
            const validation = validateFieldReference(inputSchema, transformation.sourceField);
            if (!validation.valid && validation.error) {
                warnings.push(validation.error);
            }
        }

        // Type-specific validations
        if (type === 'cast' && !transformation.toType) {
            warnings.push('Target type is required for cast operation');
        }

        if (type === 'replace' && (!transformation.oldValue || !transformation.newValue)) {
            warnings.push('Both old value and new value are required for replace');
        }

        return warnings;
    }
</script>

<div class="space-y-3">
    <div class="flex items-center justify-between">
        <div class="space-y-0.5">
            <Label class="text-xs font-medium">Transformations</Label>
            {#if inputSchema && inputSchema.fields && inputSchema.fields.length > 0}
                <p class="text-xs text-muted-foreground">
                    {inputSchema.fields.length} field{inputSchema.fields.length !== 1 ? 's' : ''} available from source
                </p>
            {/if}
        </div>
        <div class="flex items-center gap-2">
            {#if inputSampleData}
                <Button
                    variant={showPreview ? "default" : "outline"}
                    size="sm"
                    on:click={() => {
                        showPreview = !showPreview;
                        if (showPreview) {
                            generatePreview();
                        }
                    }}
                    class="h-7 text-xs"
                >
                    <Eye class="h-3 w-3 mr-1" />
                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                </Button>
            {/if}
            <Button
                variant="outline"
                size="sm"
                on:click={addTransformation}
                class="h-7 text-xs"
            >
                <Plus class="h-3 w-3 mr-1" />
                Add Transformation
            </Button>
        </div>
    </div>

    {#if !isNodeSaved}
        <div class="text-xs text-blue-600 py-2 border border-blue-200 rounded-md p-2 bg-blue-50">
            Node not saved yet. Save the workflow to enable schema-aware field pickers and preview.
        </div>
    {:else if isLoadingSchema}
        <div class="text-xs text-muted-foreground py-2">Loading schema...</div>
    {:else if !hasUpstreamConnections && node.data.workflowNodeType === 'processor'}
        <div class="text-xs text-amber-600 py-2 border border-amber-200 rounded-md p-2 bg-amber-50">
            No upstream connections. Connect a source node to see available fields and enable field pickers.
        </div>
    {:else if !inputSchema && hasUpstreamConnections && node.data.workflowNodeType === 'processor'}
        {@const upstreamNodeIds = workflowEditorStore.edges.filter(e => e.target === node.id).map(e => e.source)}
        {@const upstreamNodeId = upstreamNodeIds[0]}
        {@const upstreamSchema = upstreamNodeId ? workflowEditorStore.nodeSchemas.get(upstreamNodeId) : null}
        {@const upstreamLoading = upstreamNodeId ? workflowEditorStore.loadingSchema.get(upstreamNodeId) : false}
        {@const upstreamNode = upstreamNodeId ? workflowEditorStore.nodes.find(n => n.id === upstreamNodeId) : null}
        
        <div class="text-xs text-amber-600 py-2 border border-amber-200 rounded-md p-2 bg-amber-50 space-y-1">
            <div>No input schema available.</div>
            {#if upstreamNodeId}
                <div class="text-xs opacity-75">
                    Upstream node: {upstreamNodeId}
                    {#if upstreamNode}
                        ({upstreamNode.data.nodeType})
                    {/if}
                </div>
                {#if upstreamLoading}
                    <div class="text-xs opacity-75">Loading upstream schema...</div>
                {:else if upstreamSchema}
                    <div class="text-xs opacity-75">Upstream schema exists but not accessible. Try refreshing.</div>
                {:else if upstreamNode}
                    <div class="text-xs opacity-75">
                        {#if workflowEditorStore.isTemporaryNodeId(upstreamNodeId)}
                            Computing schema for unsaved node... (this may take a moment)
                        {:else}
                            Upstream schema not fetched. Check console for errors.
                        {/if}
                    </div>
                {:else}
                    <div class="text-xs opacity-75">Upstream schema not fetched. Check console for errors.</div>
                {/if}
            {/if}
        </div>
    {/if}

    {#if transformations.length === 0}
        <div class="space-y-3">
            <div class="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md">
                No transformations configured. Get started with:
            </div>
            
            {#if inputSchema && inputSchema.fields && inputSchema.fields.length > 0}
                <!-- Quick Actions -->
                <div class="grid grid-cols-2 gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        on:click={() => addQuickTransformation('rename')}
                        class="h-8 text-xs justify-start"
                    >
                        <Plus class="h-3 w-3 mr-1" />
                        Rename Field
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        on:click={() => addQuickTransformation('delete')}
                        class="h-8 text-xs justify-start"
                    >
                        <Plus class="h-3 w-3 mr-1" />
                        Delete Field
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        on:click={() => addQuickTransformation('lowercase')}
                        class="h-8 text-xs justify-start"
                    >
                        <Plus class="h-3 w-3 mr-1" />
                        Lowercase Field
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        on:click={() => addQuickTransformation('uppercase')}
                        class="h-8 text-xs justify-start"
                    >
                        <Plus class="h-3 w-3 mr-1" />
                        Uppercase Field
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        on:click={() => addQuickTransformation('cast')}
                        class="h-8 text-xs justify-start"
                    >
                        <Plus class="h-3 w-3 mr-1" />
                        Cast Type
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        on:click={() => addQuickTransformation('add')}
                        class="h-8 text-xs justify-start"
                    >
                        <Plus class="h-3 w-3 mr-1" />
                        Add New Field
                    </Button>
                </div>
                
                <!-- Available Fields Preview -->
                <div class="border rounded-md p-2 bg-muted/30">
                    <p class="text-xs font-medium mb-2">Available Fields ({inputSchema.fields.length}):</p>
                    <div class="flex flex-wrap gap-1.5">
                        {#each inputSchema.fields.slice(0, 10) as field}
                            <Badge variant="outline" class="text-xs">
                                {field.name} <span class="text-muted-foreground">({field.type})</span>
                            </Badge>
                        {/each}
                        {#if inputSchema.fields.length > 10}
                            <Badge variant="outline" class="text-xs">
                                +{inputSchema.fields.length - 10} more
                            </Badge>
                        {/if}
                    </div>
                </div>
            {:else if !inputSchema}
                <div class="text-xs text-muted-foreground text-center py-2">
                    Connect a source node to see available fields
                </div>
            {/if}
        </div>
    {:else}
        <div class="space-y-2">
            {#each (Array.isArray(transformations) ? transformations : []) as transformation, index}
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

                    <!-- Transformation Type -->
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

                    <!-- Validation Warnings -->
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
                            {#if inputSchema && inputSchema.fields && inputSchema.fields.length > 0}
                                <!-- Use FieldPicker when schema is available -->
                                <FieldPicker
                                    schema={inputSchema}
                                    value={transformation.sourceField || ''}
                                    onValueChange={(value) => updateTransformation(index, 'sourceField', value)}
                                    placeholder="Select source field"
                                    allowCustom={true}
                                    customPlaceholder="Or enter field name"
                                    showSource={true}
                                />
                                {#if transformation.sourceField && !inputSchema.fields.some(f => f.name === transformation.sourceField)}
                                    <p class="text-xs text-amber-600">
                                        Field "{transformation.sourceField}" not found in input schema. Make sure it exists.
                                    </p>
                                {/if}
                            {:else}
                                <!-- Fallback to text input if no schema available -->
                                <Input
                                    type="text"
                                    value={transformation.sourceField || ''}
                                    on:input={(e) => updateTransformation(index, 'sourceField', e.currentTarget.value)}
                                    placeholder="e.g., email, name, age"
                                    class="h-8 text-xs"
                                />
                                {#if !inputSchema}
                                    <p class="text-xs text-muted-foreground">
                                        Connect a source node to see available fields
                                    </p>
                                {/if}
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
                            {#if transformation.type === 'add' || transformation.type === 'rename' || transformation.type === 'copy'}
                                <!-- For add/rename/copy, allow custom field name -->
                                <Input
                                    type="text"
                                    value={transformation.targetField || ''}
                                    on:input={(e) => updateTransformation(index, 'targetField', e.currentTarget.value)}
                                    placeholder="e.g., new_field_name"
                                    class="h-8 text-xs"
                                />
                            {:else if inputSchema}
                                <!-- For other operations, show field picker with custom allowed -->
                                <FieldPicker
                                    schema={inputSchema}
                                    value={transformation.targetField || ''}
                                    onValueChange={(value) => updateTransformation(index, 'targetField', value)}
                                    placeholder="Select target field"
                                    allowCustom={true}
                                    customPlaceholder="Enter field name"
                                />
                            {:else}
                                <Input
                                    type="text"
                                    value={transformation.targetField || ''}
                                    on:input={(e) => updateTransformation(index, 'targetField', e.currentTarget.value)}
                                    placeholder="e.g., new_field_name"
                                    class="h-8 text-xs"
                                />
                            {/if}
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
                            <div class="space-y-1">
                                <p class="text-xs text-muted-foreground">
                                    Use ${fieldName} to reference other fields
                                </p>
                                {#if inputSchema && inputSchema.fields.length > 0}
                                    <div class="flex flex-wrap gap-1">
                                        <span class="text-xs text-muted-foreground">Quick insert:</span>
                                        {#each inputSchema.fields.slice(0, 6) as field}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                class="h-5 text-xs px-1.5 py-0"
                                                on:click={() => {
                                                    const current = transformation.expression || '';
                                                    const fieldRef = `\${${field.name}}`;
                                                    updateTransformation(index, 'expression', current + (current ? ' + ' : '') + fieldRef);
                                                }}
                                            >
                                                ${field.name}
                                            </Button>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
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

                    <!-- Concat Fields (special handling for concat) -->
                    {#if transformation.type === 'concat' && inputSchema}
                        <div class="space-y-1.5">
                            <Label class="text-xs">Additional Fields to Concatenate</Label>
                            {#if inputSchema.fields && inputSchema.fields.length > 0}
                                <div class="space-y-2">
                                    <Input
                                        type="text"
                                        value={transformation.targetField || ''}
                                        on:input={(e) => updateTransformation(index, 'targetField', e.currentTarget.value)}
                                        placeholder="field1,field2,field3 (comma-separated)"
                                        class="h-8 text-xs"
                                    />
                                    <div class="flex flex-wrap gap-1.5">
                                        <p class="text-xs text-muted-foreground w-full">Quick select fields:</p>
                                        {#each inputSchema.fields.slice(0, 8) as field}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                class="h-6 text-xs px-2"
                                                on:click={() => {
                                                    const current = transformation.targetField || '';
                                                    const fields = current ? current.split(',').map(f => f.trim()).filter(Boolean) : [];
                                                    if (!fields.includes(field.name)) {
                                                        fields.push(field.name);
                                                        updateTransformation(index, 'targetField', fields.join(','));
                                                    }
                                                }}
                                            >
                                                + {field.name}
                                            </Button>
                                        {/each}
                                    </div>
                                </div>
                            {:else}
                                <Input
                                    type="text"
                                    value={transformation.targetField || ''}
                                    on:input={(e) => updateTransformation(index, 'targetField', e.currentTarget.value)}
                                    placeholder="field1,field2,field3 (comma-separated)"
                                    class="h-8 text-xs"
                                />
                            {/if}
                            <p class="text-xs text-muted-foreground">
                                Enter comma-separated field names. Source field will be included automatically.
                            </p>
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
        </div>
    {/if}

    <!-- Preview Section -->
    {#if showPreview}
        <div class="space-y-2 pt-3 border-t">
            <Label class="text-xs font-medium">Preview</Label>
            {#if previewError}
                <div class="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                    {previewError}
                </div>
            {:else if previewData.length === 0}
                <div class="text-xs text-muted-foreground">No preview data available</div>
            {:else}
                <div class="space-y-2 max-h-96 overflow-auto border rounded-md">
                    <div class="sticky top-0 bg-muted/50 border-b p-2">
                        <div class="text-xs font-medium">
                            Showing {previewData.length} of {inputSampleData?.metadata?.record_count || 0} records
                        </div>
                    </div>
                    <div class="p-2">
                        {#if previewData.length === 0}
                            <div class="text-xs text-muted-foreground py-4 text-center">
                                No data to preview
                            </div>
                        {:else}
                            {@const allFields = new Set<string>()}
                            {#each previewData as record}
                                {#each Object.keys(record) as key}
                                    {allFields.add(key)}
                                {/each}
                            {/each}
                            {@const fieldNames = Array.from(allFields)}
                            
                            <table class="w-full text-xs border-collapse">
                                <thead class="bg-muted/30 sticky top-0">
                                    <tr>
                                        {#each fieldNames as fieldName}
                                            <th class="text-left p-1.5 border-b font-medium">{fieldName}</th>
                                        {/each}
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each previewData.slice(0, 10) as record}
                                        <tr class="border-b hover:bg-muted/20">
                                            {#each fieldNames as fieldName}
                                                <td class="p-1.5 text-muted-foreground">
                                                    {#if record[fieldName] === null || record[fieldName] === undefined}
                                                        <span class="text-muted-foreground/50">—</span>
                                                    {:else if typeof record[fieldName] === 'object'}
                                                        <span class="font-mono text-[10px]">{JSON.stringify(record[fieldName])}</span>
                                                    {:else}
                                                        {String(record[fieldName]).slice(0, 50)}{String(record[fieldName]).length > 50 ? '...' : ''}
                                                    {/if}
                                                </td>
                                            {/each}
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                            {#if previewData.length > 10}
                                <div class="text-xs text-muted-foreground p-2 text-center">
                                    Showing first 10 of {previewData.length} records
                                </div>
                            {/if}
                        {/if}
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>


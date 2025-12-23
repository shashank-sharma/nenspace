<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import { ArrowRight, Plus, X } from 'lucide-svelte';
    import type { DataSchema } from '../types';
    import FieldPicker from './FieldPicker.svelte';

    let {
        inputSchema,
        mappings = $bindable([]),
        onMappingsChange
    } = $props<{
        inputSchema: DataSchema | null;
        mappings?: Array<{ source: string; target: string; transform?: string }>;
        onMappingsChange?: (mappings: Array<{ source: string; target: string; transform?: string }>) => void;
    }>();

    function addMapping() {
        mappings = [...mappings, { source: '', target: '' }];
        if (onMappingsChange) {
            onMappingsChange(mappings);
        }
    }

    function removeMapping(index: number) {
        mappings = mappings.filter((_, i) => i !== index);
        if (onMappingsChange) {
            onMappingsChange(mappings);
        }
    }

    function updateMapping(index: number, field: 'source' | 'target' | 'transform', value: string) {
        mappings = mappings.map((m, i) => {
            if (i === index) {
                return { ...m, [field]: value };
            }
            return m;
        });
        if (onMappingsChange) {
            onMappingsChange(mappings);
        }
    }

    const availableFields = $derived(() => {
        if (!inputSchema || !inputSchema.fields) return [];
        return inputSchema.fields.map(f => f.name);
    });

    const mappedFields = $derived(() => {
        return new Set(mappings.map(m => m.source).filter(Boolean));
    });

    const unmappedFields = $derived(() => {
        if (!inputSchema || !inputSchema.fields) return [];
        return inputSchema.fields
            .map(f => f.name)
            .filter(name => !mappedFields().has(name));
    });
</script>

<div class="space-y-3">
    <div class="flex items-center justify-between">
        <div>
            <p class="text-xs font-medium">Field Mapping</p>
            <p class="text-xs text-muted-foreground">Map source fields to target fields</p>
        </div>
        <Button
            variant="outline"
            size="sm"
            on:click={addMapping}
            class="h-7 text-xs"
        >
            <Plus class="h-3 w-3 mr-1" />
            Add Mapping
        </Button>
    </div>

    {#if mappings.length === 0}
        <div class="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md">
            No field mappings. Click "Add Mapping" to get started.
        </div>
    {:else}
        <div class="space-y-2">
            {#each mappings as mapping, index}
                <div class="border rounded-md p-3 bg-card">
                    <div class="flex items-center gap-2">
                        <div class="flex-1">
                            <FieldPicker
                                schema={inputSchema}
                                value={mapping.source || ''}
                                onValueChange={(value) => updateMapping(index, 'source', value)}
                                placeholder="Select source field"
                                allowCustom={true}
                                showSource={true}
                            />
                        </div>
                        <ArrowRight class="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div class="flex-1">
                            <input
                                type="text"
                                value={mapping.target || ''}
                                on:input={(e) => updateMapping(index, 'target', e.currentTarget.value)}
                                placeholder="Target field name"
                                class="h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            class="h-6 w-6 flex-shrink-0"
                            on:click={() => removeMapping(index)}
                        >
                            <X class="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    {#if unmappedFields().length > 0 && inputSchema}
        <div class="border rounded-md p-2 bg-muted/30">
            <p class="text-xs font-medium mb-2">Unmapped Fields:</p>
            <div class="flex flex-wrap gap-1.5">
                {#each unmappedFields().slice(0, 10) as fieldName}
                    <Button
                        variant="outline"
                        size="sm"
                        class="h-6 text-xs px-2"
                        on:click={() => {
                            addMapping();
                            const newIndex = mappings.length - 1;
                            updateMapping(newIndex, 'source', fieldName);
                            updateMapping(newIndex, 'target', fieldName);
                        }}
                    >
                        + {fieldName}
                    </Button>
                {/each}
            </div>
        </div>
    {/if}
</div>


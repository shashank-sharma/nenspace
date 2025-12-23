<script lang="ts">
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import { Root as SelectRoot, Trigger as SelectTrigger, Value as SelectValue, Content as SelectContent, Item as SelectItem } from '$lib/components/ui/select';
    import { Button } from '$lib/components/ui/button';
    import { X, Loader2, AlertTriangle } from 'lucide-svelte';
    import { workflowStore, workflowEditorStore } from '../stores';
    import { WorkflowService } from '../services/workflow.service';
    import type { FlowNode } from '../types';
    import TransformConfigPanel from './TransformConfigPanel.svelte';

    let { node = null, onClose, hideHeader = false } = $props<{ node?: FlowNode | null; onClose?: () => void; hideHeader?: boolean }>();

    let config = $derived(node?.data.config || {});
    let schema = $derived(node ? (workflowStore.connectors.find((c: any) => c.id === node.data.nodeType)?.configSchema || {}) : {});
    
    // PocketBase specific state - check both possible nodeType values
    let isPocketBaseSource = $derived.by(() => {
        if (!node?.data.nodeType) return false;
        const nodeType = node.data.nodeType.toLowerCase();
        return nodeType === 'pocketbase_source' || 
               nodeType === 'pocketbase' || 
               nodeType.includes('pocketbase');
    });

    // Transform processor specific state
    let isTransformProcessor = $derived.by(() => {
        if (!node?.data.nodeType) return false;
        const nodeType = node.data.nodeType.toLowerCase();
        return nodeType === 'transform_processor';
    });
    let collections = $state<Array<{ id: string; name: string; type: string }>>([]);
    let loadingCollections = $state(false);
    let collectionSchema = $state<{ collection: string; fields: Array<{ name: string; type: string; required: boolean; default?: any }> } | null>(null);
    let loadingSchema = $state(false);
    let collectionCount = $state<number | null>(null);
    let loadingCount = $state(false);
    let collectionError = $state<string | null>(null);
    let lastCollectionName = $state<string | null>(null);
    let lastCountCollectionName = $state<string | null>(null);
    let loadedNodeId = $state<string | null>(null);

    // Clear localStorage cache on page refresh (check on component mount)
    $effect(() => {
        const refreshFlag = sessionStorage.getItem('pocketbase_cache_initialized');
        if (!refreshFlag) {
            // Fresh page load - clear all localStorage caches
            localStorage.removeItem('pocketbase_collections');
            // Clear all schema caches (keys start with 'pocketbase_schema_')
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('pocketbase_schema_')) {
                    localStorage.removeItem(key);
                }
            });
            // Mark that we've initialized for this session
            sessionStorage.setItem('pocketbase_cache_initialized', 'true');
        }
    });

    // Load collections when PocketBase source is detected (only once per node ID)
    $effect(() => {
        const currentNodeId = node?.id;
        const currentIsPocketBase = isPocketBaseSource;
        
        // Skip if no node
        if (!currentNodeId) {
            return;
        }
        
        // If node ID changed to a different node, reset state
        if (loadedNodeId !== null && currentNodeId !== loadedNodeId) {
            collections = [];
            collectionSchema = null;
            collectionCount = null;
            lastCollectionName = null;
            lastCountCollectionName = null;
            loadedNodeId = null;
        }
        
        // Load collections only if: PocketBase source AND not already loaded for this node ID AND not currently loading
        if (currentIsPocketBase && currentNodeId !== loadedNodeId && !loadingCollections) {
            loadedNodeId = currentNodeId;
            loadCollections();
        } else if (!currentIsPocketBase && loadedNodeId !== null) {
            // Not PocketBase source, clear collections
            collections = [];
            collectionSchema = null;
            lastCollectionName = null;
            loadedNodeId = null;
        }
    });

    // Load schema and count when collection changes (only if collection name actually changed)
    $effect(() => {
        const currentCollection = config.collection;
        if (isPocketBaseSource && currentCollection && currentCollection !== lastCollectionName && currentCollection !== collectionSchema?.collection && !loadingSchema) {
            lastCollectionName = currentCollection;
            loadCollectionSchema(currentCollection);
        }
    });

    // Load count when collection changes (separate effect to avoid duplicate calls)
    $effect(() => {
        const currentCollection = config.collection;
        if (isPocketBaseSource && currentCollection && currentCollection !== lastCountCollectionName && !loadingCount) {
            lastCountCollectionName = currentCollection;
            loadCollectionCount(currentCollection);
        }
    });

    async function loadCollections() {
        // Check localStorage cache first
        const cacheKey = 'pocketbase_collections';
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Ensure cached collections are sorted
                    collections = parsed.sort((a, b) => a.name.localeCompare(b.name));
                    loadingCollections = false;
                    return;
                }
            } catch (e) {
                // Invalid cache, continue to fetch
            }
        }

        loadingCollections = true;
        collectionError = null;
        try {
            const result = await WorkflowService.getPocketBaseCollections();
            if (result && Array.isArray(result) && result.length > 0) {
                // Sort collections alphabetically by name
                collections = result.sort((a, b) => a.name.localeCompare(b.name));
                // Cache in localStorage (persists during session, cleared on page refresh)
                localStorage.setItem(cacheKey, JSON.stringify(collections));
            } else {
                collections = [];
                collectionError = result === null ? 'Failed to load collections' : 'No collections available';
            }
        } catch (error) {
            console.error('Error loading collections:', error);
            collectionError = 'Failed to load collections';
            collections = [];
        } finally {
            loadingCollections = false;
        }
    }

    async function loadCollectionSchema(collectionName: string) {
        if (!collectionName) return;
        
        // Check localStorage cache first
        const cacheKey = `pocketbase_schema_${collectionName}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed && parsed.collection === collectionName) {
                    collectionSchema = parsed;
                    // Don't call loadCollectionCount here - let the separate effect handle it
                    return;
                }
            } catch (e) {
                // Invalid cache, continue to fetch
            }
        }

        loadingSchema = true;
        collectionError = null;
        const result = await WorkflowService.getPocketBaseCollectionSchema(collectionName);
        if (result) {
            collectionSchema = result;
            console.log('Loaded collection schema:', result);
            // Cache in localStorage (persists during session, cleared on page refresh)
            localStorage.setItem(cacheKey, JSON.stringify(result));
        } else {
            collectionError = 'Failed to load collection schema';
            collectionSchema = null;
            console.error('Failed to load collection schema for:', collectionName);
        }
        loadingSchema = false;
    }

    async function loadCollectionCount(collectionName: string) {
        if (!collectionName) return;
        
        // Prevent duplicate calls - check if already loading or already loaded for this collection
        if (loadingCount || (collectionName === lastCountCollectionName && collectionCount !== null)) {
            return;
        }
        
        loadingCount = true;
        try {
            const count = await WorkflowService.getPocketBaseCollectionCount(collectionName);
            if (count !== null) {
                collectionCount = count;
            } else {
                collectionCount = null;
            }
        } catch (error) {
            console.error('Error loading collection count:', error);
            collectionCount = null;
        } finally {
            loadingCount = false;
        }
    }

    function getFieldTypeDisplay(type: string): string {
        const typeMap: Record<string, string> = {
            'text': 'Text',
            'number': 'Number',
            'bool': 'Boolean',
            'date': 'Date',
            'select': 'Select',
            'relation': 'Relation',
            'file': 'File',
            'json': 'JSON',
            'email': 'Email',
            'url': 'URL',
            'editor': 'Editor',
            'autodate': 'Auto Date'
        };
        return typeMap[type] || type;
    }

    function updateConfig(key: string, value: any) {
        if (!node) return;
        const newConfig = { ...config, [key]: value };
        console.log('Updating config for node:', node.id, 'key:', key, 'value:', value, 'newConfig:', newConfig);
        workflowEditorStore.updateNode(node.id, {
            data: {
                ...node.data,
                config: newConfig
            }
        });
        // Verify persistence - check after a brief delay to ensure store update completed
        setTimeout(() => {
            const updatedNode = workflowEditorStore.nodes.find(n => n.id === node.id);
            if (updatedNode) {
                console.log('✅ Node config persisted:', updatedNode.data.config);
                console.log('✅ Collection value:', updatedNode.data.config?.collection);
            }
        }, 100);
    }

    function renderField(key: string, fieldSchema: any): any {
        const value = config[key];
        const isRequired = (schema as any).required?.includes(key);

        switch ((fieldSchema as any).type) {
            case 'string':
                if ((fieldSchema as any).enum) {
                    return {
                        type: 'select',
                        value: value || (fieldSchema as any).default || '',
                        options: (fieldSchema as any).enum
                    };
                }
                if ((fieldSchema as any).format === 'textarea' || ((fieldSchema as any).title && (fieldSchema as any).title.toLowerCase().includes('description'))) {
                    return {
                        type: 'textarea',
                        value: value || (fieldSchema as any).default || ''
                    };
                }
                return {
                    type: 'input',
                    value: value || (fieldSchema as any).default || '',
                    inputType: (fieldSchema as any).format === 'email' ? 'email' : (fieldSchema as any).format === 'url' ? 'url' : 'text'
                };
            case 'number':
                return {
                    type: 'input',
                    value: value !== undefined ? String(value) : ((fieldSchema as any).default !== undefined ? String((fieldSchema as any).default) : ''),
                    inputType: 'number',
                    min: (fieldSchema as any).minimum,
                    max: (fieldSchema as any).maximum
                };
            case 'boolean':
                return {
                    type: 'checkbox',
                    value: value !== undefined ? value : ((fieldSchema as any).default !== undefined ? (fieldSchema as any).default : false)
                };
            default:
                return null;
        }
    }
</script>

{#if node}
    <div class="config-panel h-full flex flex-col {hideHeader ? 'pt-0' : 'pt-2'}">
        {#if !hideHeader}
            <div class="flex flex-row items-start justify-between gap-2 pb-2 border-b px-3">
                <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-medium">Node Configuration</h3>
                    <p class="text-xs text-muted-foreground truncate">{node.data.label}</p>
                </div>
                {#if onClose}
                    <Button
                        variant="ghost"
                        size="icon"
                        class="h-6 w-6 flex-shrink-0"
                        on:click={onClose}
                        title="Close configuration"
                    >
                        <X class="h-4 w-4" />
                    </Button>
                {/if}
            </div>
        {/if}
        <div class="space-y-3 flex-1 overflow-y-auto {hideHeader ? 'pt-2' : 'pt-2'} px-3 pb-3 custom-scrollbar">
            {#if isPocketBaseSource}
                <!-- Always show collection selector for PocketBase sources -->
                <div class="space-y-1.5">
                    <Label class="text-xs">
                        Collection
                        <span class="text-destructive">*</span>
                    </Label>
                    {#if loadingCollections}
                        <div class="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 class="h-4 w-4 animate-spin" />
                            <span>Loading collections...</span>
                        </div>
                    {:else if collectionError}
                        <div class="text-xs text-destructive">{collectionError}</div>
                        <Button variant="outline" size="sm" on:click={loadCollections}>Retry</Button>
                    {:else}
                        {@const fieldValue = config.collection || ''}
                        {#if collections.length === 0}
                            <div class="text-xs text-muted-foreground">No collections available</div>
                        {:else}
                            <SelectRoot
                                selected={fieldValue ? { value: fieldValue, label: fieldValue } : undefined}
                                onSelectedChange={(selected) => {
                                    if (selected) {
                                        updateConfig('collection', selected.value);
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a collection" />
                                </SelectTrigger>
                                <SelectContent side="bottom" class="max-h-[200px] overflow-y-auto select-custom-scrollbar">
                                    {#each collections as collection}
                                        <SelectItem value={collection.name}>{collection.name}</SelectItem>
                                    {/each}
                                </SelectContent>
                            </SelectRoot>
                        {/if}
                    {/if}
                    {#if !config.collection}
                        <div class="flex items-center gap-2 text-xs text-amber-600 mt-1">
                            <AlertTriangle class="h-3 w-3" />
                            <span>Please select a collection</span>
                        </div>
                    {/if}
                </div>
            {/if}
            {#if isTransformProcessor}
                <!-- Transform Processor has special UI -->
                <TransformConfigPanel {node} />
            {:else if (schema as any).properties || ((schema as any).type !== 'object' && Object.keys(schema || {}).length > 0)}
                {@const schemaProperties = (schema as any).properties || schema}
                {#if schemaProperties && Object.keys(schemaProperties).length > 0}
                    {#each Object.entries(schemaProperties) as [key, fieldSchema]}
                    <!-- Skip collection field for PocketBase sources as it's handled above -->
                    {#if !(isPocketBaseSource && key === 'collection')}
                        {@const field = renderField(key, fieldSchema)}
                        {#if field}
                            <div class="space-y-1.5">
                                <Label class="text-xs">
                                    {(fieldSchema as any).title || key}
                                    {#if (schema as any).required?.includes(key)}
                                        <span class="text-destructive">*</span>
                                    {/if}
                                </Label>
                                {#if field.type === 'input'}
                                <Input
                                    type={field.inputType}
                                    value={field.value}
                                    on:input={(e) => {
                                        const val = field.inputType === 'number' ? Number(e.currentTarget.value) : e.currentTarget.value;
                                        updateConfig(key, val);
                                    }}
                                    min={field.min}
                                    max={field.max}
                                    placeholder={(fieldSchema as any).description}
                                />
                            {:else if field.type === 'textarea'}
                                <Textarea
                                    value={field.value}
                                    on:input={(e) => updateConfig(key, e.currentTarget.value)}
                                    placeholder={(fieldSchema as any).description}
                                />
                            {:else if field.type === 'checkbox'}
                                <div class="flex items-center space-x-2">
                                    <Checkbox
                                        bind:checked={field.value}
                                        on:click={() => updateConfig(key, !field.value)}
                                    />
                                    <Label class="text-xs text-muted-foreground">{(fieldSchema as any).description}</Label>
                                </div>
                            {:else if field.type === 'select'}
                                {@const fieldValue = field.value}
                                <SelectRoot
                                    selected={{ value: fieldValue, label: fieldValue }}
                                    onSelectedChange={(selected) => {
                                        if (selected) {
                                            updateConfig(key, selected.value);
                                        }
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={(fieldSchema as any).description} />
                                    </SelectTrigger>
                                    <SelectContent side="bottom" class="max-h-[200px] overflow-y-auto select-custom-scrollbar">
                                        {#each field.options as option}
                                            <SelectItem value={option}>{option}</SelectItem>
                                        {/each}
                                    </SelectContent>
                                </SelectRoot>
                            {/if}
                            {#if (fieldSchema as any).description && field.type !== 'checkbox'}
                                <p class="text-xs text-muted-foreground">{(fieldSchema as any).description}</p>
                            {/if}
                        </div>
                    {/if}
                    {/if}
                    {/each}
                {/if}
            {/if}
            {#if isPocketBaseSource && config.collection}
                <div class="space-y-2 pt-3 border-t">
                    <div class="flex items-center justify-between">
                        <Label class="text-xs font-medium">Collection Information</Label>
                        {#if loadingCount}
                            <div class="flex items-center gap-1 text-xs text-muted-foreground">
                                <Loader2 class="h-3 w-3 animate-spin" />
                                <span>Loading...</span>
                            </div>
                        {:else if collectionCount !== null && config.collection}
                            <div class="text-xs text-muted-foreground">
                                <span class="font-medium">{collectionCount.toLocaleString()}</span> row{collectionCount !== 1 ? 's' : ''}
                            </div>
                        {/if}
                    </div>
                    <div class="space-y-2">
                        <Label class="text-xs font-medium">Collection Fields</Label>
                        {#if loadingSchema}
                            <div class="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 class="h-4 w-4 animate-spin" />
                                <span>Loading schema...</span>
                            </div>
                        {:else if collectionSchema && collectionSchema.fields && collectionSchema.fields.length > 0}
                            <div class="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                                <table class="w-full text-xs">
                                    <thead class="border-b">
                                        <tr>
                                            <th class="text-left py-1 px-2 font-medium">Field</th>
                                            <th class="text-left py-1 px-2 font-medium">Type</th>
                                            <th class="text-center py-1 px-2 font-medium">Required</th>
                                            <th class="text-left py-1 px-2 font-medium">Default</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each collectionSchema.fields as field}
                                            <tr class="border-b">
                                                <td class="py-1 px-2">{field.name}</td>
                                                <td class="py-1 px-2 text-muted-foreground">{getFieldTypeDisplay(field.type)}</td>
                                                <td class="py-1 px-2 text-center">
                                                    {#if field.required}
                                                        <span class="text-green-600">✓</span>
                                                    {:else}
                                                        <span class="text-muted-foreground">—</span>
                                                    {/if}
                                                </td>
                                                <td class="py-1 px-2 text-muted-foreground">
                                                    {field.default !== undefined ? String(field.default) : '—'}
                                                </td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        {:else if collectionSchema}
                            <div class="text-xs text-muted-foreground">No fields found in this collection.</div>
                        {:else if collectionError}
                            <div class="text-xs text-destructive">{collectionError}</div>
                        {:else}
                            <div class="text-xs text-muted-foreground">Select a collection to view its fields.</div>
                        {/if}
                    </div>
                </div>
            {/if}
            {#if !isPocketBaseSource && !(schema as any)?.properties && ((schema as any)?.type === 'object' || Object.keys(schema || {}).length === 0)}
                <div class="text-xs text-muted-foreground">No configuration required for this node.</div>
            {/if}
        </div>
    </div>
{:else}
    <div class="config-panel h-full flex items-center justify-center">
        <div class="text-xs text-muted-foreground text-center">Select a node to configure</div>
    </div>
{/if}

<style>
    .config-panel {
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    /* Custom scrollbar - matching sidenav style */
    :global(.custom-scrollbar) {
        scrollbar-width: thin; /* Firefox */
        scrollbar-color: hsl(var(--muted-foreground) / 0.5)
            hsl(var(--muted) / 0.2); /* thumb track */
    }

    :global(.custom-scrollbar)::-webkit-scrollbar {
        width: 10px;
    }

    :global(.custom-scrollbar)::-webkit-scrollbar-track {
        background: hsl(var(--muted) / 0.12);
        border-radius: 8px;
    }

    :global(.custom-scrollbar)::-webkit-scrollbar-thumb {
        background-color: hsl(var(--muted-foreground) / 0.45);
        border-radius: 8px;
        border: 2px solid hsl(var(--background));
    }

    :global(.custom-scrollbar)::-webkit-scrollbar-thumb:hover {
        background-color: hsl(var(--muted-foreground) / 0.6);
    }

    :global(.custom-scrollbar)::-webkit-scrollbar-thumb:active {
        background-color: hsl(var(--foreground) / 0.6);
    }

    /* Also apply to select dropdowns */
    :global(.select-custom-scrollbar) {
        scrollbar-width: thin; /* Firefox */
        scrollbar-color: hsl(var(--muted-foreground) / 0.5)
            hsl(var(--muted) / 0.2); /* thumb track */
    }

    :global(.select-custom-scrollbar)::-webkit-scrollbar {
        width: 10px;
    }

    :global(.select-custom-scrollbar)::-webkit-scrollbar-track {
        background: hsl(var(--muted) / 0.12);
        border-radius: 8px;
    }

    :global(.select-custom-scrollbar)::-webkit-scrollbar-thumb {
        background-color: hsl(var(--muted-foreground) / 0.45);
        border-radius: 8px;
        border: 2px solid hsl(var(--background));
    }

    :global(.select-custom-scrollbar)::-webkit-scrollbar-thumb:hover {
        background-color: hsl(var(--muted-foreground) / 0.6);
    }

    :global(.select-custom-scrollbar)::-webkit-scrollbar-thumb:active {
        background-color: hsl(var(--foreground) / 0.6);
    }

</style>


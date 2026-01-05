<script lang="ts">
    import { Root as Tabs, Content as TabsContent, List as TabsList, Trigger as TabsTrigger } from '$lib/components/ui/tabs';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import type { FlowNode, DataSchema } from '../types';
    import { workflowEditorStore } from '../stores';
    import ColumnSelectionTab from './ColumnSelectionTab.svelte';
    import TransformationTab from './TransformationTab.svelte';
    import PreviewTab from './PreviewTab.svelte';

    let { node } = $props<{ node: FlowNode }>();

    // Get input schema (what flows INTO this node from upstream)
    const inputSchema = $derived(workflowEditorStore.getNodeInputSchema(node.id));
    
    // Get output schema (what flows OUT OF this node after transformations)
    const outputSchema = $derived(workflowEditorStore.getNodeOutputSchema(node.id));
    
    // Check if workflow data is still loading
    const isLoadingWorkflowData = $derived(workflowEditorStore.isLoadingWorkflowData);

    // Check if node has upstream connections
    const hasUpstreamConnections = $derived(workflowEditorStore.edges.some(e => e.target === node.id));
    
    // Check if node is saved (not a temporary ID)
    const isNodeSaved = $derived(() => {
        // Temporary IDs follow pattern: node_<timestamp>_<random>
        return !/^node_\d+_[a-z0-9]+$/i.test(node.id);
    });

    // Selected columns state
    let selectedColumns = $state<string[]>([]);

    // Transformations state
    let transformations = $state<Array<Record<string, any>>>([]);

    // Active tab
    let activeTab = $state<'columns' | 'transformations' | 'preview'>('columns');
    
    // Load selectedColumns and transformations from node config
    $effect(() => {
        if (node) {
            const config = node.data.config || {};
            
            // Load selected columns
            if (Array.isArray(config.selectedColumns)) {
                selectedColumns = [...config.selectedColumns];
            } else {
                selectedColumns = [];
            }
            
            // Load transformations
            const configTransformations = config.transformations;
            if (Array.isArray(configTransformations)) {
                transformations = configTransformations.map(t => ({ ...t }));
            } else if (configTransformations) {
                transformations = [configTransformations];
            } else {
                transformations = [];
            }
        } else {
            selectedColumns = [];
            transformations = [];
        }
    });

    // Update node config when selectedColumns changes
    function updateSelectedColumns(newColumns: string[]) {
        selectedColumns = newColumns;
        if (!node) return;
        
        workflowEditorStore.updateNode(node.id, {
            data: {
                ...node.data,
                config: {
                    ...node.data.config,
                    selectedColumns: newColumns
                }
            }
        });
    }

    // Update node config when transformations change
    function updateTransformations(newTransformations: Array<Record<string, any>>) {
        transformations = newTransformations;
        if (!node) return;
        
        workflowEditorStore.updateNode(node.id, {
            data: {
                ...node.data,
                config: {
                    ...node.data.config,
                    transformations: newTransformations
                }
            }
        });
    }

    // Handle tab change with validation
    function handleTabChange(newTab: string) {
        if (newTab === 'transformations' && selectedColumns.length === 0) {
            // Can't go to transformations without selected columns
            return;
        }
        if (newTab === 'preview' && transformations.length === 0) {
            // Can't go to preview without transformations
            return;
        }
        activeTab = newTab as typeof activeTab;
    }

    // Handle apply from preview tab
    function handleApply() {
        // Transformations are already saved, just show success
        // Could close drawer here if needed
    }
</script>

<div class="space-y-3 h-full flex flex-col">
    {#if !isNodeSaved}
        <div class="text-xs text-blue-600 py-2 border border-blue-200 rounded-md p-2 bg-blue-50">
            Node not saved yet. Save the workflow to enable schema-aware field pickers and preview.
        </div>
    {:else if !hasUpstreamConnections && node.data.workflowNodeType === 'processor'}
        <div class="text-xs text-amber-600 py-2 border border-amber-200 rounded-md p-2 bg-amber-50">
            No upstream connections. Connect a source node to see available fields and enable field pickers.
        </div>
    {:else if isLoadingWorkflowData}
        <div class="text-xs text-muted-foreground py-2 border border-border rounded-md p-2 bg-muted/20 space-y-1">
            <div>Loading workflow data...</div>
            <div class="text-xs opacity-75">
                {workflowEditorStore.loadProgress.phase}
                {#if workflowEditorStore.loadProgress.total > 0}
                    ({workflowEditorStore.loadProgress.current}/{workflowEditorStore.loadProgress.total} nodes)
                {/if}
            </div>
        </div>
    {:else if !inputSchema && hasUpstreamConnections && node.data.workflowNodeType === 'processor'}
        <div class="text-xs text-amber-600 py-2 border border-amber-200 rounded-md p-2 bg-amber-50 space-y-1">
            <div>No input schema available.</div>
            <div class="text-xs opacity-75">
                This may indicate that workflow data is still loading or there was an error during preload.
                {#if workflowEditorStore.loadErrors.size > 0}
                    <Button
                        variant="outline"
                        size="sm"
                        class="h-5 text-xs mt-1"
                        on:click={() => workflowEditorStore.retryFailedNodes()}
                    >
                        Retry Failed Nodes
                    </Button>
                {/if}
            </div>
        </div>
    {/if}

    <Tabs bind:value={activeTab} onValueChange={handleTabChange} class="flex-1 flex flex-col min-h-0">
        <TabsList class="grid w-full grid-cols-3">
            <TabsTrigger value="columns" class="text-xs">
                Columns
                {#if selectedColumns.length > 0}
                    <Badge variant="secondary" class="ml-1 text-[10px]">
                        {selectedColumns.length}
                            </Badge>
                                {/if}
            </TabsTrigger>
            <TabsTrigger 
                value="transformations" 
                class="text-xs"
                disabled={selectedColumns.length === 0}
            >
                Transformations
                {#if transformations.length > 0}
                    <Badge variant="secondary" class="ml-1 text-[10px]">
                        {transformations.length}
                    </Badge>
                    {/if}
            </TabsTrigger>
            <TabsTrigger 
                value="preview" 
                class="text-xs"
                disabled={transformations.length === 0}
            >
                Preview
            </TabsTrigger>
        </TabsList>

        <TabsContent value="columns" class="flex-1 min-h-0 mt-4">
            <!-- Debug info -->
            {#if inputSchema}
                <div class="text-xs text-muted-foreground mb-2 p-2 bg-muted/30 rounded">
                    Debug: Input schema has {inputSchema.fields?.length || 0} fields, 
                    {inputSchema.source_nodes?.length || 0} source nodes
                </div>
            {/if}
            <ColumnSelectionTab
                inputSchema={inputSchema}
                selectedColumns={selectedColumns}
                onSelectedColumnsChange={updateSelectedColumns}
            />
        </TabsContent>

        <TabsContent value="transformations" class="flex-1 min-h-0 mt-4">
            <TransformationTab
                {node}
                inputSchema={inputSchema}
                {selectedColumns}
                {transformations}
                onTransformationsChange={updateTransformations}
            />
        </TabsContent>

        <TabsContent value="preview" class="flex-1 min-h-0 mt-4">
            <PreviewTab
                {node}
                {transformations}
                onApply={handleApply}
            />
        </TabsContent>
    </Tabs>
</div>

import { browser } from '$app/environment';
import { WorkflowService } from '../services/workflow.service';
import { workflowNodeToFlowNode, flowNodeToWorkflowNode, workflowConnectionToFlowEdge, flowEdgeToWorkflowConnection, generateNodeId, generateEdgeId } from '../utils/node-mapper.util';
import { validateWorkflowGraph } from '../utils/validation.util';
import { topologicalSortNodes, groupNodesByLevel } from '../utils/topological-sort';
import type { FlowNode, FlowEdge, ValidationResult, WorkflowNode, WorkflowConnection, Connector, DataSchema, DataEnvelope } from '../types';
import { workflowStore } from './workflow.store.svelte';

const STORAGE_PREFIX = 'workflow_editor_';

function getStorageKey(workflowId: string): string {
    return `${STORAGE_PREFIX}${workflowId}`;
}

function saveToLocalStorage(workflowId: string, nodes: FlowNode[], edges: FlowEdge[]) {
    if (!browser) return;
    try {
        const data = {
            nodes,
            edges,
            timestamp: Date.now()
        };
        localStorage.setItem(getStorageKey(workflowId), JSON.stringify(data));
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
    }
}

function loadFromLocalStorage(workflowId: string): { nodes: FlowNode[]; edges: FlowEdge[] } | null {
    if (!browser) return null;
    try {
        const stored = localStorage.getItem(getStorageKey(workflowId));
        if (!stored) return null;
        const data = JSON.parse(stored);
        return {
            nodes: data.nodes || [],
            edges: data.edges || []
        };
    } catch (error) {
        console.error('Failed to load from localStorage:', error);
        return null;
    }
}

function clearLocalStorage(workflowId: string) {
    if (!browser) return;
    try {
        localStorage.removeItem(getStorageKey(workflowId));
    } catch (error) {
        console.error('Failed to clear localStorage:', error);
    }
}

class WorkflowEditorStore {
    nodes = $state<FlowNode[]>([]);
    edges = $state<FlowEdge[]>([]);
    selectedNode = $state<FlowNode | null>(null);
    validationResult = $state<ValidationResult | null>(null);
    isDirty = $state(false);
    isLoading = $state(false);
    error = $state<string | null>(null);
    workflowId = $state<string | null>(null);
    connectors = $state<Map<string, Connector>>(new Map());
    
    // Schema and sample data cache for nodes
    nodeSchemas = $state<Map<string, DataSchema>>(new Map());
    nodeSampleData = $state<Map<string, DataEnvelope>>(new Map());
    loadingSchema = $state<Map<string, boolean>>(new Map());
    
    // Workflow data preloading state
    isLoadingWorkflowData = $state<boolean>(false);
    loadProgress = $state<{ current: number; total: number; phase: string }>({ current: 0, total: 0, phase: '' });
    loadErrors = $state<Map<string, string>>(new Map());
    
    // Undo/Redo history
    private history: Array<{ nodes: FlowNode[]; edges: FlowEdge[] }> = [];
    private historyIndex = $state(-1);
    private maxHistorySize = 50;

    get hasNodes() {
        return this.nodes.length > 0;
    }

    get hasEdges() {
        return this.edges.length > 0;
    }

    get sourceNodes() {
        return this.nodes.filter(n => n.data.workflowNodeType === 'source');
    }

    get destinationNodes() {
        return this.nodes.filter(n => n.data.workflowNodeType === 'destination');
    }

    get canUndo() {
        return this.historyIndex > 0;
    }

    get canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    private saveState() {
        // Remove any future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Add current state to history
        this.history.push({
            nodes: JSON.parse(JSON.stringify(this.nodes)),
            edges: JSON.parse(JSON.stringify(this.edges))
        });
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }

    undo() {
        if (!this.canUndo) return;
        
        this.historyIndex--;
        const state = this.history[this.historyIndex];
        this.nodes = JSON.parse(JSON.stringify(state.nodes));
        this.edges = JSON.parse(JSON.stringify(state.edges));
        this.isDirty = true;
        this.persistToLocalStorage();
        this.validate();
    }

    redo() {
        if (!this.canRedo) return;
        
        this.historyIndex++;
        const state = this.history[this.historyIndex];
        this.nodes = JSON.parse(JSON.stringify(state.nodes));
        this.edges = JSON.parse(JSON.stringify(state.edges));
        this.isDirty = true;
        this.persistToLocalStorage();
        this.validate();
    }

    setConnectors(connectors: Connector[]) {
        this.connectors = new Map(connectors.map(c => [c.id, c]));
    }

    async loadWorkflow(workflowId: string) {
        if (this.workflowId === workflowId && !this.isDirty) {
            return;
        }

        if (this.isLoading) {
            return;
        }

        this.isLoading = true;
        this.error = null;
        this.workflowId = workflowId;

        try {
            // First try to load from localStorage
            const localData = loadFromLocalStorage(workflowId);
            
            // Always fetch from server to get latest data
            const graph = await WorkflowService.getWorkflowGraph(workflowId);
            
            if (!graph) {
                this.error = 'Failed to load workflow graph';
                return;
            }

            const serverNodes = graph.nodes.map(workflowNodeToFlowNode);
            const serverEdges = graph.connections.map(workflowConnectionToFlowEdge);

            // If we have local data, merge it (prefer local for unsaved changes)
            if (localData && localData.nodes.length > 0) {
                // Merge: use local nodes if they exist, otherwise use server nodes
                // Match nodes by ID and preserve local positions/configs
                const nodeMap = new Map(serverNodes.map(n => [n.id, n]));
                const mergedNodes = localData.nodes.map(localNode => {
                    const serverNode = nodeMap.get(localNode.id);
                    if (serverNode) {
                        // Merge: keep local position and config, but update other fields from server
                        return {
                            ...serverNode,
                            position: localNode.position,
                            data: {
                                ...serverNode.data,
                                config: localNode.data.config
                            }
                        };
                    }
                    return localNode; // Keep local-only nodes
                });
                
                // Add any new server nodes that aren't in local
                serverNodes.forEach(serverNode => {
                    if (!localData.nodes.find(n => n.id === serverNode.id)) {
                        mergedNodes.push(serverNode);
                    }
                });

                this.nodes = mergedNodes;
                this.edges = localData.edges.length > 0 ? localData.edges : serverEdges;
                this.isDirty = true; // Mark as dirty since we're using local data
                
                // Initialize history with current state
                this.history = [{
                    nodes: JSON.parse(JSON.stringify(this.nodes)),
                    edges: JSON.parse(JSON.stringify(this.edges))
                }];
                this.historyIndex = 0;
            } else {
                // No local data, use server data
                this.nodes = serverNodes;
                this.edges = serverEdges;
                
                // Initialize history with current state
                this.history = [{
                    nodes: JSON.parse(JSON.stringify(this.nodes)),
                    edges: JSON.parse(JSON.stringify(this.edges))
                }];
                this.historyIndex = 0;
                this.isDirty = false;
            }

            this.selectedNode = null;
            
            // Clear old data before preloading
            this.nodeSchemas.clear();
            this.nodeSampleData.clear();
            this.loadErrors.clear();
            this.validationResult = null;
            
            // Preload all workflow data (schemas, sample data, validation)
            await this.preloadAllWorkflowData();
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Unknown error occurred';
        } finally {
            this.isLoading = false;
        }
    }

    addNode(node: Omit<FlowNode, 'id'> | { connectorId: string; position: { x: number; y: number } }) {
        this.saveState();
        
        let newNode: FlowNode;
        
        if ('connectorId' in node) {
            // New node from connector
            const connector = this.connectors.get(node.connectorId);
            if (!connector) {
                throw new Error(`Connector not found: ${node.connectorId}`);
            }
            
            newNode = {
                id: generateNodeId(),
                type: `workflow-${connector.type}`,
                position: node.position,
                data: {
                    label: connector.name,
                    nodeType: connector.id,
                    config: {},
                    workflowNodeType: connector.type
                }
            };
        } else {
            // Existing node structure
            newNode = {
                ...node,
                id: generateNodeId()
            };
        }
        
        this.nodes = [...this.nodes, newNode];
        this.isDirty = true;
        this.persistToLocalStorage();
        this.validate();
    }
    
    getNodeConnectionCounts(nodeId: string): { incoming: number; outgoing: number } {
        return {
            incoming: this.edges.filter(e => e.target === nodeId).length,
            outgoing: this.edges.filter(e => e.source === nodeId).length
        };
    }
    
    isNodeConfigured(nodeId: string): boolean {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return false;
        
        const connector = this.connectors.get(node.data.nodeType);
        if (!connector || !connector.configSchema) return true; // No schema means no config needed
        
        const schema = connector.configSchema as any;
        const requiredFields = schema.required || [];
        const config = node.data.config || {};
        
        // Special validation for PocketBase sources - must have collection selected
        const nodeType = node.data.nodeType?.toLowerCase() || '';
        if (nodeType === 'pocketbase_source' || nodeType === 'pocketbase' || nodeType.includes('pocketbase')) {
            if (!config.collection || config.collection === '') {
                return false;
            }
        }
        
        // Check if all required fields are present and not empty
        const allRequiredFieldsValid = requiredFields.every((field: string) => {
            const value = config[field];
            return value !== undefined && value !== null && value !== '';
        });
        
        return allRequiredFieldsValid;
    }

    updateNode(nodeId: string, updates: Partial<FlowNode>, saveHistory: boolean = false) {
        // Save state only if explicitly requested (e.g., when drag ends)
        if (saveHistory) {
            this.saveState();
        }
        
        this.nodes = this.nodes.map(n => 
            n.id === nodeId ? { ...n, ...updates } : n
        );
        this.isDirty = true;
        if (this.selectedNode?.id === nodeId) {
            this.selectedNode = this.nodes.find(n => n.id === nodeId) || null;
        }
        this.persistToLocalStorage();
        this.validate();
    }

    removeNode(nodeId: string) {
        this.saveState();
        
        this.nodes = this.nodes.filter(n => n.id !== nodeId);
        this.edges = this.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
        this.isDirty = true;
        if (this.selectedNode?.id === nodeId) {
            this.selectedNode = null;
        }
        this.persistToLocalStorage();
        this.validate();
    }

    addEdge(edge: Omit<FlowEdge, 'id'>) {
        this.saveState();
        
        const newEdge: FlowEdge = {
            ...edge,
            id: generateEdgeId()
        };
        this.edges = [...this.edges, newEdge];
        this.isDirty = true;
        this.persistToLocalStorage();
        this.validate();
        
        // Fetch/compute source node schema FIRST (needed for downstream processors to see available fields)
        // This works for both saved nodes (via API) and temporary nodes (via local computation)
        const sourceNode = this.nodes.find(n => n.id === edge.source);
        if (sourceNode && sourceNode.data.workflowNodeType === 'source') {
            // Fetch/compute source schema first, then fetch target schema after a short delay
            this.fetchNodeSchemaAndSample(edge.source).then(() => {
                // After source schema is fetched/computed, fetch target node schema
                const targetNode = this.nodes.find(n => n.id === edge.target);
                if (targetNode && (targetNode.data.workflowNodeType === 'processor' || targetNode.data.workflowNodeType === 'destination')) {
                    // Small delay to ensure source schema is cached
                    setTimeout(() => {
                        this.fetchNodeSchemaAndSample(edge.target);
                    }, 100);
                }
            }).catch(() => {
                // Even if source fetch fails, try to fetch target
                const targetNode = this.nodes.find(n => n.id === edge.target);
                if (targetNode && (targetNode.data.workflowNodeType === 'processor' || targetNode.data.workflowNodeType === 'destination')) {
                    this.fetchNodeSchemaAndSample(edge.target);
                }
            });
        } else {
            // No source node, just fetch target
            const targetNode = this.nodes.find(n => n.id === edge.target);
            if (targetNode && (targetNode.data.workflowNodeType === 'processor' || targetNode.data.workflowNodeType === 'destination')) {
                this.fetchNodeSchemaAndSample(edge.target);
            }
        }
    }

    removeEdge(edgeId: string) {
        this.saveState();
        
        const edge = this.edges.find(e => e.id === edgeId);
        this.edges = this.edges.filter(e => e.id !== edgeId);
        this.isDirty = true;
        this.persistToLocalStorage();
        this.validate();
        
        // Clear schema cache for target node if edge was removed
        if (edge) {
            this.nodeSchemas.delete(edge.target);
            this.nodeSampleData.delete(edge.target);
            
            // Refetch if node is still selected
            if (this.selectedNode?.id === edge.target) {
                const targetNode = this.nodes.find(n => n.id === edge.target);
                if (targetNode && this.workflowId && (targetNode.data.workflowNodeType === 'processor' || targetNode.data.workflowNodeType === 'destination')) {
                    this.fetchNodeSchemaAndSample(edge.target);
                }
            }
        }
    }

    selectNode(node: FlowNode | null) {
        this.selectedNode = node;
        
        if (!node || !this.workflowId) return;
        
        // For processor/destination nodes, fetch their schema AND upstream schemas
        if (node.data.workflowNodeType === 'processor' || node.data.workflowNodeType === 'destination') {
            // First, ensure upstream nodes' schemas are fetched
            const upstreamNodeIds = this.edges
                .filter(e => e.target === node.id)
                .map(e => e.source);
            
            // Fetch upstream schemas first (especially source nodes)
            for (const upstreamId of upstreamNodeIds) {
                if (!this.isTemporaryNodeId(upstreamId) && !this.loadingSchema.get(upstreamId)) {
                    // Fetch upstream schema - don't await, but ensure it starts
                    this.fetchNodeSchemaAndSample(upstreamId).catch(() => {
                        // Silently ignore errors
                    });
                }
            }
            
            // Then fetch this node's schema (which depends on upstream)
            this.fetchNodeSchemaAndSample(node.id);
        }
        
        // Also fetch schema for source nodes (needed for downstream processors)
        if (node.data.workflowNodeType === 'source') {
            this.fetchNodeSchemaAndSample(node.id);
        }
    }

    /**
     * Check if a node ID is a temporary frontend-generated ID (not saved to backend yet)
     * Temporary IDs follow the pattern: node_<timestamp>_<random>
     */
    isTemporaryNodeId(nodeId: string): boolean {
        // Temporary IDs are generated as: node_${Date.now()}_${random}
        // Backend IDs are typically shorter and don't follow this pattern
        return /^node_\d+_[a-z0-9]+$/i.test(nodeId);
    }

    async fetchNodeSchemaAndSample(nodeId: string, retryCount = 0) {
        // Check if node exists
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        // For temporary nodes (unsaved), compute schema entirely locally
        if (this.isTemporaryNodeId(nodeId)) {
            if (node.data.workflowNodeType === 'source') {
                // Source nodes: compute from config
                await this.computeSchemaForTemporarySourceNode(nodeId, node);
                return;
            } else {
                // Processor/destination nodes: compute from upstream schemas
                await this.computeSchemaForTemporaryProcessorNode(nodeId, node);
                return;
            }
        }
        
        // For saved nodes, use backend API
        if (!this.workflowId) return;
        
        // For processor/destination nodes, ensure upstream schemas are fetched first
        if (node.data.workflowNodeType !== 'source') {
            const upstreamNodeIds = this.edges
                .filter(e => e.target === nodeId)
                .map(e => e.source);
            
            if (upstreamNodeIds.length === 0) {
                // No upstream nodes, clear any cached data
                this.nodeSchemas.delete(nodeId);
                this.nodeSampleData.delete(nodeId);
                return;
            }
            
            // Fetch all upstream schemas first (recursively)
            // This ensures we have all necessary data before fetching this node's schema
            const upstreamPromises = upstreamNodeIds
                .filter(id => !this.isTemporaryNodeId(id))
                .map(async (upstreamId) => {
                    // If already cached, we're good
                    if (this.nodeSchemas.has(upstreamId)) {
                        return;
                    }
                    // If already loading, wait for it to complete
                    if (this.loadingSchema.get(upstreamId)) {
                        // Wait for the loading to complete (poll with timeout)
                        const maxWait = 10000; // 10 seconds max
                        const startTime = Date.now();
                        while (this.loadingSchema.get(upstreamId) && (Date.now() - startTime) < maxWait) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                        // If still not cached after waiting, fetch it
                        if (!this.nodeSchemas.has(upstreamId)) {
                            await this.fetchNodeSchemaAndSample(upstreamId);
                        }
                    } else {
                        // Not loading and not cached - fetch it
                        await this.fetchNodeSchemaAndSample(upstreamId);
                    }
                });
            
            // Wait for all upstream schemas to be fetched
            await Promise.all(upstreamPromises);
            
            // Verify all upstream schemas are now available
            const allUpstreamSchemasAvailable = upstreamNodeIds
                .filter(id => !this.isTemporaryNodeId(id))
                .every(id => this.nodeSchemas.has(id));
            
            if (!allUpstreamSchemasAvailable) {
                console.warn(`Some upstream schemas still missing for node ${nodeId} after fetch attempt`);
            }
        }
        
        // Check if already loading
        if (this.loadingSchema.get(nodeId)) return;
        
        this.loadingSchema.set(nodeId, true);
        
        try {
            // Fetch schema - backend recursively computes through entire chain
            const schema = await WorkflowService.getNodeOutputSchema(this.workflowId, nodeId);
            if (schema) {
                this.nodeSchemas.set(nodeId, schema);
                console.log(`✅ Schema fetched for node ${nodeId}:`, schema);
            } else {
                console.warn(`⚠️ No schema returned for node ${nodeId}`);
                // Retry once if schema is missing and we haven't retried yet
                if (retryCount === 0) {
                    await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
                    return this.fetchNodeSchemaAndSample(nodeId, retryCount + 1);
                }
            }
            
            // Fetch sample data (limit to 10 for preview) - backend recursively executes chain
            const sampleData = await WorkflowService.getNodeSampleData(this.workflowId, nodeId, 10);
            if (sampleData) {
                this.nodeSampleData.set(nodeId, sampleData);
                console.log(`✅ Sample data fetched for node ${nodeId}:`, sampleData.metadata?.record_count || 0, 'records');
            } else {
                console.warn(`⚠️ No sample data returned for node ${nodeId}`);
            }
            
            // Also fetch schemas for direct upstream nodes to populate cache
            // This ensures field pickers work correctly
            const hasUpstream = this.edges.some(e => e.target === nodeId);
            if (hasUpstream) {
                const upstreamNodeIds = this.edges
                    .filter(e => e.target === nodeId)
                    .map(e => e.source);
                
                // Fetch upstream nodes' schemas in parallel (but don't wait for errors)
                for (const upstreamId of upstreamNodeIds) {
                    if (!this.loadingSchema.get(upstreamId) && !this.nodeSchemas.has(upstreamId)) {
                        // Fetch/compute in background - works for both saved and temporary nodes
                        this.fetchNodeSchemaAndSample(upstreamId).catch(() => {
                            // Silently ignore errors for upstream nodes
                        });
                    }
                }
            }
        } catch (error: any) {
            // Handle "node not found" error gracefully (node might not be saved yet)
            if (error?.status === 400 || error?.response?.code === 'BAD_REQUEST') {
                // Node not found - likely not saved yet, clear cache
                this.nodeSchemas.delete(nodeId);
                this.nodeSampleData.delete(nodeId);
                // Don't log this as an error, it's expected for unsaved nodes
            } else {
                console.error('Failed to fetch node schema/sample:', error);
                // Retry once on network errors
                if (retryCount === 0 && (error?.status >= 500 || error?.message?.includes('network'))) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
                    return this.fetchNodeSchemaAndSample(nodeId, retryCount + 1);
                }
                // Clear cached data on error after retries exhausted
                this.nodeSchemas.delete(nodeId);
                this.nodeSampleData.delete(nodeId);
            }
        } finally {
            this.loadingSchema.set(nodeId, false);
        }
    }

    /**
     * Compute schema for a temporary (unsaved) source node based on its configuration
     * This allows us to show schemas even before the workflow is saved
     */
    private async computeSchemaForTemporarySourceNode(nodeId: string, node: FlowNode) {
        // Check if already loading
        if (this.loadingSchema.get(nodeId)) return;
        
        this.loadingSchema.set(nodeId, true);
        
        try {
            // Handle PocketBase source nodes
            if (node.data.nodeType === 'pocketbase_source' || node.data.nodeType?.toLowerCase().includes('pocketbase')) {
                const collectionName = node.data.config?.collection;
                if (collectionName) {
                    // Fetch collection schema directly (doesn't require node to be saved)
                    const collectionSchema = await WorkflowService.getPocketBaseCollectionSchema(collectionName);
                    if (collectionSchema && collectionSchema.fields) {
                        // Convert collection schema to DataSchema format
                        const dataSchema: DataSchema = {
                            fields: collectionSchema.fields
                                .filter(f => f.name) // Filter out fields without names
                                .map(f => ({
                                    name: f.name || 'unknown',
                                    type: this.mapPocketBaseTypeToSchemaType(f.type),
                                    source_node: nodeId,
                                    nullable: !f.required,
                                    description: f.default !== undefined ? `Default: ${f.default}` : undefined
                                })),
                            source_nodes: [nodeId]
                        };
                        
                        this.nodeSchemas.set(nodeId, dataSchema);
                        console.log(`✅ Computed schema for temporary PocketBase source node ${nodeId}:`, dataSchema);
                    }
                }
            }
            // Add support for other source types here as needed
        } catch (error) {
            console.error(`Failed to compute schema for temporary source node ${nodeId}:`, error);
        } finally {
            this.loadingSchema.set(nodeId, false);
        }
    }

    /**
     * Compute schema for a temporary (unsaved) processor/destination node
     * This computes the output schema based on the node's configuration and upstream schemas
     */
    private async computeSchemaForTemporaryProcessorNode(nodeId: string, node: FlowNode) {
        // Check if already loading
        if (this.loadingSchema.get(nodeId)) return;
        
        this.loadingSchema.set(nodeId, true);
        
        try {
            // First, ensure upstream schemas are computed
            const upstreamNodeIds = this.edges
                .filter(e => e.target === nodeId)
                .map(e => e.source);
            
            // Compute upstream schemas if needed
            for (const upstreamId of upstreamNodeIds) {
                if (!this.nodeSchemas.has(upstreamId) && !this.loadingSchema.get(upstreamId)) {
                    await this.fetchNodeSchemaAndSample(upstreamId);
                }
            }
            
            // Get input schema from upstream nodes (now that they're computed)
            // We need to manually merge schemas here instead of calling getNodeInputSchema
            // to avoid state mutations in reactive contexts
            const upstreamSchemas: DataSchema[] = [];
            for (const upstreamId of upstreamNodeIds) {
                const schema = this.nodeSchemas.get(upstreamId);
                if (schema) {
                    upstreamSchemas.push(schema);
                }
            }
            
            if (upstreamSchemas.length === 0) {
                console.warn(`No input schema available for temporary processor node ${nodeId}`);
                return;
            }
            
            // Merge schemas if multiple upstream nodes
            const inputSchema = upstreamSchemas.length === 1 
                ? upstreamSchemas[0] 
                : this.mergeSchemas(upstreamSchemas, upstreamNodeIds);
            
            // Compute output schema based on node type
            let outputSchema: DataSchema | null = null;
            
            if (node.data.nodeType === 'transform_processor') {
                outputSchema = this.computeTransformOutputSchema(inputSchema, node.data.config);
            } else if (node.data.nodeType === 'pb_to_csv_converter') {
                // CSV converter is pass-through
                outputSchema = inputSchema;
            } else if (node.data.nodeType === 'script_processor') {
                // Script nodes: can't determine output without executing, use input as best guess
                outputSchema = inputSchema;
            } else {
                // For other processor types, use input schema as fallback
                outputSchema = inputSchema;
            }
            
            if (outputSchema) {
                this.nodeSchemas.set(nodeId, outputSchema);
                console.log(`✅ Computed schema for temporary processor node ${nodeId}:`, outputSchema);
            }
        } catch (error) {
            console.error(`Failed to compute schema for temporary processor node ${nodeId}:`, error);
        } finally {
            this.loadingSchema.set(nodeId, false);
        }
    }

    /**
     * Compute output schema for transform processor based on transformations
     */
    private computeTransformOutputSchema(inputSchema: DataSchema, config: any): DataSchema {
        const transformations = config?.transformations || [];
        if (!Array.isArray(transformations) || transformations.length === 0) {
            // No transformations, return input schema as-is
            return inputSchema;
        }
        
        // Create a copy of input schema fields
        const fieldMap = new Map<string, typeof inputSchema.fields[0]>();
        for (const field of inputSchema.fields) {
            fieldMap.set(field.name, { ...field });
        }
        
        // Apply transformations to schema
        for (const transformation of transformations) {
            const transType = transformation.type;
            const sourceField = transformation.sourceField;
            const targetField = transformation.targetField;
            
            switch (transType) {
                case 'rename':
                    if (sourceField && targetField && fieldMap.has(sourceField)) {
                        const field = fieldMap.get(sourceField)!;
                        field.name = targetField;
                        fieldMap.set(targetField, field);
                        fieldMap.delete(sourceField);
                    }
                    break;
                case 'delete':
                    if (sourceField) {
                        fieldMap.delete(sourceField);
                    }
                    break;
                case 'add':
                    if (targetField) {
                        fieldMap.set(targetField, {
                            name: targetField,
                            type: 'string',
                            nullable: true,
                            source_node: inputSchema.source_nodes[0] || ''
                        });
                    }
                    break;
                case 'cast':
                    if (sourceField && fieldMap.has(sourceField)) {
                        const field = fieldMap.get(sourceField)!;
                        if (transformation.toType) {
                            field.type = transformation.toType;
                        }
                        if (targetField && targetField !== sourceField) {
                            field.name = targetField;
                            fieldMap.set(targetField, field);
                            fieldMap.delete(sourceField);
                        }
                    }
                    break;
                case 'copy':
                    if (sourceField && targetField && fieldMap.has(sourceField)) {
                        const field = { ...fieldMap.get(sourceField)! };
                        field.name = targetField;
                        fieldMap.set(targetField, field);
                    }
                    break;
            }
        }
        
        return {
            fields: Array.from(fieldMap.values()),
            source_nodes: inputSchema.source_nodes
        };
    }

    /**
     * Map PocketBase field types to our schema types
     */
    private mapPocketBaseTypeToSchemaType(pbType: string | null | undefined): 'string' | 'number' | 'boolean' | 'date' | 'json' {
        if (!pbType) {
            return 'string'; // Default to string if type is missing
        }
        switch (pbType.toLowerCase()) {
            case 'text':
            case 'email':
            case 'url':
            case 'editor':
            case 'select':
                return 'string';
            case 'number':
                return 'number';
            case 'bool':
                return 'boolean';
            case 'date':
                return 'date';
            case 'json':
            case 'relation':
            case 'file':
                return 'json';
            default:
                return 'string';
        }
    }

    /**
     * Get the input schema for a node (what it receives from upstream).
     * For processor nodes, this is the merged output schema of all upstream nodes.
     * Handles multiple upstream nodes by merging their schemas.
     */
    /**
     * Get the input schema for a node (what it receives from upstream).
     * For processor nodes, this is the merged output schema of all upstream nodes.
     * Handles multiple upstream nodes by merging their schemas.
     * 
     * Simplified: Just reads from cache (no dynamic fetching).
     * All schemas should be preloaded via preloadAllWorkflowData().
     */
    getNodeInputSchema(nodeId: string): DataSchema | null {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) {
            return null;
        }
        
        // For source nodes, there's no input schema
        if (node.data.workflowNodeType === 'source') {
            return null;
        }
        
        // Find all upstream nodes
        const upstreamNodeIds = this.edges
            .filter(e => e.target === nodeId)
            .map(e => e.source);
        
        if (upstreamNodeIds.length === 0) {
            return null;
        }
        
        // Get output schemas from all upstream nodes (from cache only)
        const upstreamSchemas: DataSchema[] = [];
        
        for (const upstreamNodeId of upstreamNodeIds) {
            const upstreamSchema = this.nodeSchemas.get(upstreamNodeId);
            if (upstreamSchema) {
                upstreamSchemas.push(upstreamSchema);
            } else {
                // Schema not in cache - this shouldn't happen if preloading worked
                // But we'll return null gracefully instead of triggering fetch
                console.warn(`getNodeInputSchema: Schema not in cache for upstream node ${upstreamNodeId}`);
            }
        }
        
        // If no schemas available, return null
        if (upstreamSchemas.length === 0) {
            return null;
        }
        
        // If single upstream node, return its schema directly
        // But ensure source_nodes includes the upstream node ID and fields have source_node set
        if (upstreamSchemas.length === 1) {
            const schema = upstreamSchemas[0];
            const upstreamNodeId = upstreamNodeIds[0];
            
            // Check if we need to update source_nodes or field source_node properties
            const needsSourceNodesUpdate = !schema.source_nodes || schema.source_nodes.length === 0 || !schema.source_nodes.includes(upstreamNodeId);
            const needsFieldSourceNodeUpdate = schema.fields && schema.fields.some(f => !f.source_node);
            
            if (needsSourceNodesUpdate || needsFieldSourceNodeUpdate) {
                return {
                    ...schema,
                    source_nodes: schema.source_nodes && schema.source_nodes.length > 0 
                        ? [...schema.source_nodes, upstreamNodeId].filter((id, index, arr) => arr.indexOf(id) === index) // Remove duplicates
                        : [upstreamNodeId],
                    fields: schema.fields ? schema.fields.map(field => ({
                        ...field,
                        source_node: field.source_node || upstreamNodeId
                    })) : []
                };
            }
            
            return schema;
        }
        
        // Multiple upstream nodes: merge schemas
        return this.mergeSchemas(upstreamSchemas, upstreamNodeIds);
    }
    
    /**
     * Merge multiple schemas into one, handling field conflicts
     */
    private mergeSchemas(schemas: DataSchema[], sourceNodeIds: string[]): DataSchema {
        if (schemas.length === 0) {
            return { fields: [], source_nodes: [] };
        }
        
        if (schemas.length === 1) {
            return schemas[0];
        }
        
        const merged: DataSchema = {
            fields: [],
            source_nodes: []
        };
        
        // Collect all source nodes from schemas
        const sourceNodeSet = new Set<string>();
        for (const schema of schemas) {
            for (const nodeId of schema.source_nodes || []) {
                sourceNodeSet.add(nodeId);
            }
        }
        
        // If schemas don't have source_nodes populated (backend issue), use the upstream node IDs
        // This ensures we always have the correct source nodes even if backend doesn't populate them
        if (sourceNodeSet.size === 0 && sourceNodeIds.length > 0) {
            for (const nodeId of sourceNodeIds) {
                sourceNodeSet.add(nodeId);
            }
        }
        
        merged.source_nodes = Array.from(sourceNodeSet);
        
        // Build node labels map for conflict resolution
        const nodeLabels = new Map<string, string>();
        for (const nodeId of sourceNodeIds) {
            const node = this.nodes.find(n => n.id === nodeId);
            if (node) {
                nodeLabels.set(nodeId, node.data.label);
            }
        }
        
        // Track field names and their occurrences
        const fieldMap = new Map<string, { field: typeof schemas[0]['fields'][0], count: number }>();
        const conflictFields = new Set<string>();
        
        // First pass: collect all fields and count occurrences
        // Also track which schema each field comes from
        for (let schemaIndex = 0; schemaIndex < schemas.length; schemaIndex++) {
            const schema = schemas[schemaIndex];
            const sourceNodeId = sourceNodeIds[schemaIndex]; // Get the corresponding source node ID
            
            for (const field of schema.fields) {
                const existing = fieldMap.get(field.name);
                if (existing) {
                    existing.count++;
                    conflictFields.add(field.name);
                } else {
                    fieldMap.set(field.name, { field, count: 1 });
                }
            }
        }
        
        // Second pass: add fields with conflict resolution and ensure source_node is set
        const addedFields = new Set<string>();
        for (let schemaIndex = 0; schemaIndex < schemas.length; schemaIndex++) {
            const schema = schemas[schemaIndex];
            const sourceNodeId = sourceNodeIds[schemaIndex]; // Get the corresponding source node ID
            
            for (const field of schema.fields) {
                let fieldName = field.name;
                let fieldToAdd = { ...field };
                
                // Ensure source_node is set (use the source node ID for this schema)
                if (!fieldToAdd.source_node) {
                    fieldToAdd.source_node = sourceNodeId;
                }
                
                // If field conflicts, prefix with source node label
                if (conflictFields.has(field.name)) {
                    const sourceLabel = nodeLabels.get(fieldToAdd.source_node || '') || fieldToAdd.source_node?.substring(0, 8) || 'unknown';
                    fieldName = `${sourceLabel}_${field.name}`;
                    fieldToAdd.name = fieldName;
                    fieldToAdd.description = field.description || `${field.name} (from ${sourceLabel})`;
                }
                
                // Avoid duplicates
                if (!addedFields.has(fieldName)) {
                    merged.fields.push(fieldToAdd);
                    addedFields.add(fieldName);
                }
            }
        }
        
        return merged;
    }

    /**
     * Get the output schema for a node (what it produces after transformations).
     * This is the node's own output schema, which includes all transformations applied.
     * 
     * Simplified: Just reads from cache (no dynamic fetching).
     * All schemas should be preloaded via preloadAllWorkflowData().
     */
    getNodeOutputSchema(nodeId: string): DataSchema | null {
        return this.nodeSchemas.get(nodeId) || null;
    }

    /**
     * Get sample data that flows INTO this node (from upstream).
     * This is what the node will receive as input.
     * 
     * Simplified: Just reads from cache (no dynamic fetching).
     * All sample data should be preloaded via preloadAllWorkflowData().
     */
    getNodeInputSampleData(nodeId: string): DataEnvelope | null {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return null;
        
        // For source nodes, there's no input data
        if (node.data.workflowNodeType === 'source') {
            return null;
        }
        
        // Find upstream nodes
        const upstreamNodeIds = this.edges
            .filter(e => e.target === nodeId)
            .map(e => e.source);
        
        if (upstreamNodeIds.length === 0) return null;
        
        // Get output sample data from first upstream node (from cache)
        return this.nodeSampleData.get(upstreamNodeIds[0]) || null;
    }

    /**
     * Get sample data that flows OUT OF this node (after transformations).
     * This is what the node produces after applying its transformations.
     * 
     * Simplified: Just reads from cache (no dynamic fetching).
     * All sample data should be preloaded via preloadAllWorkflowData().
     */
    getNodeOutputSampleData(nodeId: string): DataEnvelope | null {
        return this.nodeSampleData.get(nodeId) || null;
    }

    // Legacy methods for backward compatibility - use input schema for field picker
    getNodeUpstreamSchema(nodeId: string): DataSchema | null {
        return this.getNodeInputSchema(nodeId);
    }

    getNodeUpstreamSampleData(nodeId: string): DataEnvelope | null {
        return this.getNodeInputSampleData(nodeId);
    }

    /**
     * Preloads all workflow data: schemas, sample data, and validation
     * This ensures all data is available before user interaction
     */
    async preloadAllWorkflowData(): Promise<void> {
        if (!this.workflowId || this.nodes.length === 0) {
            return;
        }

        // Prevent duplicate calls - if already loading, return early
        if (this.isLoadingWorkflowData) {
            console.log('preloadAllWorkflowData: Already loading, skipping duplicate call');
            return;
        }

        this.isLoadingWorkflowData = true;
        this.loadErrors.clear();
        this.loadProgress = { current: 0, total: this.nodes.length, phase: 'Initializing...' };

        try {
            // Filter out temporary nodes (only preload saved nodes)
            const savedNodes = this.nodes.filter(n => !this.isTemporaryNodeId(n.id));
            
            if (savedNodes.length === 0) {
                // No saved nodes, just run validation
                this.loadProgress = { current: 0, total: 0, phase: 'Validating...' };
                await this.validate();
                this.isLoadingWorkflowData = false;
                return;
            }

            // Topologically sort nodes to respect dependencies
            const sortedNodes = topologicalSortNodes(savedNodes, this.edges);
            const nodeLevels = groupNodesByLevel(savedNodes, this.edges);

            // Phase 1: Load output schemas in dependency order
            this.loadProgress = { current: 0, total: sortedNodes.length, phase: 'Loading Schemas' };
            
            for (let i = 0; i < sortedNodes.length; i++) {
                const node = sortedNodes[i];
                this.loadProgress = { current: i + 1, total: sortedNodes.length, phase: 'Loading Schemas' };

                try {
                    // Skip if schema already loaded
                    if (this.nodeSchemas.has(node.id)) {
                        continue;
                    }

                    // For source nodes, fetch output schema directly
                    if (node.data.workflowNodeType === 'source') {
                        const schema = await WorkflowService.getNodeOutputSchema(this.workflowId, node.id);
                        if (schema) {
                            this.nodeSchemas.set(node.id, schema);
                        } else {
                            this.loadErrors.set(`${node.id}_schema`, `Failed to load schema for ${node.data.label}`);
                        }
                    } else {
                        // For processor/destination nodes, ensure upstream schemas are loaded first
                        const upstreamNodeIds = this.edges
                            .filter(e => e.target === node.id)
                            .map(e => e.source);

                        // Check if all upstream schemas are available
                        const allUpstreamSchemasAvailable = upstreamNodeIds.every(id => this.nodeSchemas.has(id));
                        
                        if (allUpstreamSchemasAvailable) {
                            const schema = await WorkflowService.getNodeOutputSchema(this.workflowId, node.id);
                            if (schema) {
                                this.nodeSchemas.set(node.id, schema);
                            } else {
                                this.loadErrors.set(`${node.id}_schema`, `Failed to load schema for ${node.data.label}`);
                            }
                        } else {
                            // Upstream schemas not available yet, skip for now
                            // Will be retried in next iteration if needed
                            this.loadErrors.set(`${node.id}_schema`, `Upstream schemas not available for ${node.data.label}`);
                        }
                    }
                } catch (error) {
                    // Ignore auto-cancellation errors (they're expected for duplicate requests)
                    if (error instanceof Error && (error.message?.includes('autocancelled') || error.message?.includes('auto-cancelled'))) {
                        console.log(`Schema request for node ${node.id} was auto-cancelled (duplicate request)`);
                        continue; // Skip this error
                    }
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    this.loadErrors.set(`${node.id}_schema`, `Error loading schema: ${errorMsg}`);
                    console.error(`Failed to load schema for node ${node.id}:`, error);
                }
            }

            // Phase 2: Load sample data (can be done in parallel for nodes at same level)
            this.loadProgress = { current: 0, total: sortedNodes.length, phase: 'Loading Sample Data' };

            for (let level = 0; level < nodeLevels.length; level++) {
                const levelNodes = nodeLevels[level];
                
                // Process nodes at this level in parallel, but skip if already loaded
                const sampleDataPromises = levelNodes
                    .filter(node => {
                        // Skip if already loaded or schema not available
                        if (this.nodeSampleData.has(node.id)) {
                            return false; // Already loaded
                        }
                        if (!this.nodeSchemas.has(node.id)) {
                            return false; // Schema not available, can't load sample data
                        }
                        return true;
                    })
                    .map(async (node) => {
                        const nodeIndex = sortedNodes.findIndex(n => n.id === node.id);
                        this.loadProgress = { 
                            current: nodeIndex + 1, 
                            total: sortedNodes.length, 
                            phase: 'Loading Sample Data' 
                        };

                        try {
                            // Double-check we haven't loaded it in the meantime
                            if (!this.nodeSampleData.has(node.id) && this.nodeSchemas.has(node.id) && this.workflowId) {
                                const sampleData = await WorkflowService.getNodeSampleData(this.workflowId, node.id, 10);
                                if (sampleData) {
                                    this.nodeSampleData.set(node.id, sampleData);
                                } else {
                                    this.loadErrors.set(`${node.id}_sample`, `Failed to load sample data for ${node.data.label}`);
                                }
                            }
                        } catch (error) {
                            // Ignore auto-cancellation errors (they're expected for duplicate requests)
                            if (error instanceof Error && (error.message?.includes('autocancelled') || error.message?.includes('auto-cancelled'))) {
                                console.log(`Sample data request for node ${node.id} was auto-cancelled (duplicate request)`);
                                return; // Skip this error
                            }
                            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                            this.loadErrors.set(`${node.id}_sample`, `Error loading sample data: ${errorMsg}`);
                            console.error(`Failed to load sample data for node ${node.id}:`, error);
                        }
                    });

                await Promise.all(sampleDataPromises);
            }

            // Phase 3: Run validation (requires all schemas to be loaded)
            this.loadProgress = { current: sortedNodes.length, total: sortedNodes.length, phase: 'Validating Workflow' };
            await this.validate();

        } catch (error) {
            console.error('Error during workflow data preload:', error);
            this.error = error instanceof Error ? error.message : 'Failed to preload workflow data';
        } finally {
            this.isLoadingWorkflowData = false;
            this.loadProgress = { current: 0, total: 0, phase: '' };
        }
    }

    /**
     * Check if workflow data has been fully loaded
     */
    isWorkflowDataLoaded(): boolean {
        if (!this.workflowId || this.nodes.length === 0) {
            return false;
        }

        const savedNodes = this.nodes.filter(n => !this.isTemporaryNodeId(n.id));
        
        // Check if all saved nodes have schemas loaded
        const allSchemasLoaded = savedNodes.every(node => {
            // Source nodes must have schema
            if (node.data.workflowNodeType === 'source') {
                return this.nodeSchemas.has(node.id);
            }
            // Processor/destination nodes need schema if they have upstream connections
            const hasUpstream = this.edges.some(e => e.target === node.id);
            if (hasUpstream) {
                return this.nodeSchemas.has(node.id);
            }
            return true; // No upstream, schema not required
        });

        return allSchemasLoaded && !this.isLoadingWorkflowData;
    }

    /**
     * Retry loading data for failed nodes
     */
    async retryFailedNodes(): Promise<void> {
        if (!this.workflowId) {
            return;
        }

        const failedNodeIds = new Set<string>();
        for (const [key] of this.loadErrors.entries()) {
            const nodeId = key.split('_')[0];
            failedNodeIds.add(nodeId);
        }

        if (failedNodeIds.size === 0) {
            return;
        }

        this.isLoadingWorkflowData = true;
        const failedNodes = this.nodes.filter(n => failedNodeIds.has(n.id));

        try {
            for (const node of failedNodes) {
                // Retry schema
                if (this.loadErrors.has(`${node.id}_schema`)) {
                    try {
                        const schema = await WorkflowService.getNodeOutputSchema(this.workflowId, node.id);
                        if (schema) {
                            this.nodeSchemas.set(node.id, schema);
                            this.loadErrors.delete(`${node.id}_schema`);
                        }
                    } catch (error) {
                        console.error(`Retry failed for schema ${node.id}:`, error);
                    }
                }

                // Retry sample data (only if schema is now available)
                if (this.loadErrors.has(`${node.id}_sample`) && this.nodeSchemas.has(node.id)) {
                    try {
                        const sampleData = await WorkflowService.getNodeSampleData(this.workflowId, node.id, 10);
                        if (sampleData) {
                            this.nodeSampleData.set(node.id, sampleData);
                            this.loadErrors.delete(`${node.id}_sample`);
                        }
                    } catch (error) {
                        console.error(`Retry failed for sample data ${node.id}:`, error);
                    }
                }
            }

            // Re-run validation if needed
            if (this.loadErrors.size === 0 || Array.from(this.loadErrors.keys()).every(k => !k.endsWith('_schema'))) {
                await this.validate();
            }
        } finally {
            this.isLoadingWorkflowData = false;
        }
    }

    async validate(): Promise<ValidationResult> {
        const result = validateWorkflowGraph(this.nodes, this.edges, this.connectors);
        this.validationResult = result;
        return result;
    }

    async save(): Promise<boolean> {
        let workflowId = this.workflowId;
        
        if (!workflowId && workflowStore.selectedWorkflow) {
            workflowId = workflowStore.selectedWorkflow.id;
            this.workflowId = workflowId;
        }
        
        if (!workflowId) {
            this.error = 'No workflow ID set';
            return false;
        }

        this.isLoading = true;
        this.error = null;

        try {
            const result = await WorkflowService.saveWorkflowGraph(
                workflowId,
                this.nodes,
                this.edges
            );

            if (!result) {
                this.error = 'Failed to save workflow graph';
                return false;
            }

            // Ensure validation result has proper structure
            const validation = result.validation || { valid: true, errors: [], warnings: [] };
            this.validationResult = {
                valid: validation.valid ?? true,
                errors: validation.errors || [],
                warnings: validation.warnings || []
            };

            if (!this.validationResult.valid) {
                const errorMessages = this.validationResult.errors.length > 0 
                    ? this.validationResult.errors.join(', ')
                    : 'Validation failed';
                this.error = `Validation failed: ${errorMessages}`;
                return false;
            }

            // Update nodes and edges with backend IDs after save
            // Backend returns nodes with real IDs - we need to replace our temporary IDs
            if (result.nodes.length > 0) {
                console.log('💾 Saving workflow - backend returned nodes:', result.nodes.map(n => ({ id: n.id, type: n.node_type })));
                
                // The backend returns nodes with their real IDs
                // We need to replace our nodes array with the backend nodes
                this.nodes = result.nodes.map(workflowNodeToFlowNode);
                
                console.log('✅ Nodes updated with backend IDs:', this.nodes.map(n => ({ id: n.id, type: n.data.nodeType })));
            }
            
            if (result.connections.length > 0) {
                // Update edges - backend returns connections with real IDs and updated node IDs
                this.edges = result.connections.map(workflowConnectionToFlowEdge);
                console.log('✅ Edges updated:', this.edges.map(e => ({ id: e.id, source: e.source, target: e.target })));
            }
            
            // Update selected node if it still exists
            if (this.selectedNode) {
                const updatedNode = this.nodes.find(n => 
                    n.data.nodeType === this.selectedNode?.data.nodeType &&
                    n.data.workflowNodeType === this.selectedNode?.data.workflowNodeType &&
                    Math.abs(n.position.x - (this.selectedNode?.position.x || 0)) < 50 &&
                    Math.abs(n.position.y - (this.selectedNode?.position.y || 0)) < 50
                );
                if (updatedNode) {
                    this.selectedNode = updatedNode;
                }
            }
            
            // Clear schema cache - we'll refetch with new IDs
            this.nodeSchemas.clear();
            this.nodeSampleData.clear();

            this.isDirty = false;
            // Clear localStorage after successful save
            if (this.workflowId) {
                clearLocalStorage(this.workflowId);
            }
            
            // After saving, refetch schemas for all processor/destination nodes
            // This ensures we have the latest schemas with correct node IDs
            for (const node of this.nodes) {
                if (node.data.workflowNodeType === 'processor' || node.data.workflowNodeType === 'destination') {
                    const hasUpstream = this.edges.some(e => e.target === node.id);
                    if (hasUpstream) {
                        // Fetch in background, don't await
                        this.fetchNodeSchemaAndSample(node.id).catch(() => {
                            // Silently ignore errors
                        });
                    }
                }
            }
            
            return true;
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Unknown error occurred';
            return false;
        } finally {
            this.isLoading = false;
        }
    }

    reset() {
        this.nodes = [];
        this.edges = [];
        this.selectedNode = null;
        this.validationResult = null;
        this.isDirty = false;
        this.error = null;
        if (this.workflowId) {
            clearLocalStorage(this.workflowId);
        }
        this.workflowId = null;
    }

    persistToLocalStorage() {
        if (this.workflowId && browser) {
            saveToLocalStorage(this.workflowId, this.nodes, this.edges);
        }
    }

    clearError() {
        this.error = null;
    }
}

export const workflowEditorStore = new WorkflowEditorStore();


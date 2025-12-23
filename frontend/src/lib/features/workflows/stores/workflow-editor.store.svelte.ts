import { browser } from '$app/environment';
import { WorkflowService } from '../services/workflow.service';
import { workflowNodeToFlowNode, flowNodeToWorkflowNode, workflowConnectionToFlowEdge, flowEdgeToWorkflowConnection, generateNodeId, generateEdgeId } from '../utils/node-mapper.util';
import { validateWorkflowGraph } from '../utils/validation.util';
import type { FlowNode, FlowEdge, ValidationResult, WorkflowNode, WorkflowConnection, Connector, DataSchema, DataEnvelope } from '../types';

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
            } else {
                // No local data, use server data
                this.nodes = serverNodes;
                this.edges = serverEdges;
                this.isDirty = false;
            }

            this.selectedNode = null;
            // Validate after loading
            this.validate();
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Unknown error occurred';
        } finally {
            this.isLoading = false;
        }
    }

    addNode(node: Omit<FlowNode, 'id'> | { connectorId: string; position: { x: number; y: number } }) {
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

    updateNode(nodeId: string, updates: Partial<FlowNode>) {
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

    async fetchNodeSchemaAndSample(nodeId: string) {
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
        
        // For source nodes, always fetch (they don't need upstream)
        // For processor/destination nodes, check if they have upstream connections
        if (node.data.workflowNodeType !== 'source') {
            const hasUpstream = this.edges.some(e => e.target === nodeId);
            if (!hasUpstream) {
                // No upstream nodes, clear any cached data
                this.nodeSchemas.delete(nodeId);
                this.nodeSampleData.delete(nodeId);
                return;
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
                // Clear cached data on error
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
    getNodeInputSchema(nodeId: string): DataSchema | null {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return null;
        
        // For source nodes, there's no input schema
        if (node.data.workflowNodeType === 'source') {
            return null;
        }
        
        // Find all upstream nodes
        const upstreamNodeIds = this.edges
            .filter(e => e.target === nodeId)
            .map(e => e.source);
        
        if (upstreamNodeIds.length === 0) return null;
        
        // Get output schemas from all upstream nodes
        const upstreamSchemas: DataSchema[] = [];
        const missingSchemas: string[] = [];
        
        for (const upstreamNodeId of upstreamNodeIds) {
            const upstreamSchema = this.nodeSchemas.get(upstreamNodeId);
            if (upstreamSchema) {
                upstreamSchemas.push(upstreamSchema);
            } else {
                missingSchemas.push(upstreamNodeId);
                // Don't trigger fetch here - this method is called from $derived() contexts
                // Fetching should be done separately, not inside getters
            }
        }
        
        // If we have missing schemas, schedule them to be fetched (but don't await)
        // This avoids state mutations in derived contexts
        if (missingSchemas.length > 0) {
            // Use setTimeout to defer the fetch outside of the reactive context
            setTimeout(() => {
                for (const upstreamNodeId of missingSchemas) {
                    if (!this.loadingSchema.get(upstreamNodeId) && !this.nodeSchemas.has(upstreamNodeId)) {
                        this.fetchNodeSchemaAndSample(upstreamNodeId).catch((error) => {
                            console.error(`❌ Failed to fetch/compute schema for upstream node ${upstreamNodeId}:`, error);
                        });
                    }
                }
            }, 0);
        }
        
        // If we have at least one schema, return merged result
        if (upstreamSchemas.length === 0) {
            // No schemas available yet, return null (will be available after fetch)
            return null;
        }
        
        // If single upstream node, return its schema directly
        if (upstreamSchemas.length === 1) {
            return upstreamSchemas[0];
        }
        
        // Multiple upstream nodes: merge schemas
        // The backend already merges schemas when computing input, but we need to do it here
        // for the UI to show all available fields
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
        
        // Collect all source nodes
        const sourceNodeSet = new Set<string>();
        for (const schema of schemas) {
            for (const nodeId of schema.source_nodes || []) {
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
        for (const schema of schemas) {
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
        
        // Second pass: add fields with conflict resolution
        const addedFields = new Set<string>();
        for (const schema of schemas) {
            for (const field of schema.fields) {
                let fieldName = field.name;
                let fieldToAdd = { ...field };
                
                // If field conflicts, prefix with source node label
                if (conflictFields.has(field.name)) {
                    const sourceLabel = nodeLabels.get(field.source_node || '') || field.source_node?.substring(0, 8) || 'unknown';
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
     */
    getNodeOutputSchema(nodeId: string): DataSchema | null {
        // The node's own output schema (cached from fetchNodeSchemaAndSample)
        // This already includes all transformations from the entire chain
        return this.nodeSchemas.get(nodeId) || null;
    }

    /**
     * Get sample data that flows INTO this node (from upstream).
     * This is what the node will receive as input.
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
        
        // Get output sample data from first upstream node
        // This is what flows into this node
        const upstreamOutputSample = this.nodeSampleData.get(upstreamNodeIds[0]);
        return upstreamOutputSample || null;
    }

    /**
     * Get sample data that flows OUT OF this node (after transformations).
     * This is what the node produces after applying its transformations.
     */
    getNodeOutputSampleData(nodeId: string): DataEnvelope | null {
        // The node's own output sample data (cached from fetchNodeSchemaAndSample)
        // This already includes all transformations from the entire chain
        return this.nodeSampleData.get(nodeId) || null;
    }

    // Legacy methods for backward compatibility - use input schema for field picker
    getNodeUpstreamSchema(nodeId: string): DataSchema | null {
        return this.getNodeInputSchema(nodeId);
    }

    getNodeUpstreamSampleData(nodeId: string): DataEnvelope | null {
        return this.getNodeInputSampleData(nodeId);
    }

    async validate(): Promise<ValidationResult> {
        const result = validateWorkflowGraph(this.nodes, this.edges, this.connectors);
        this.validationResult = result;
        return result;
    }

    async save(): Promise<boolean> {
        if (!this.workflowId) {
            this.error = 'No workflow ID set';
            return false;
        }

        this.isLoading = true;
        this.error = null;

        try {
            const result = await WorkflowService.saveWorkflowGraph(
                this.workflowId,
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


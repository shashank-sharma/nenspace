import { browser } from '$app/environment';
import { pb } from '$lib/config/pocketbase';
import { NetworkService } from '$lib/services/network.service.svelte';
import { FilterBuilder } from '$lib/utils';
import type { Workflow, WorkflowNode, WorkflowConnection, Connector, ValidationResult, FlowNode, FlowEdge } from '../types';
import type { RecordModel } from 'pocketbase';
import { COLLECTIONS } from '../constants';

function convertToWorkflow(record: RecordModel): Workflow {
    return {
        id: record.id,
        name: record.name,
        description: record.description || '',
        active: record.active ?? true,
        user: record.user,
        config: record.config || {},
        timeout: record.timeout ?? 3600,
        max_retries: record.max_retries ?? 0,
        retry_delay: record.retry_delay ?? 1,
        created: record.created,
        updated: record.updated
    };
}

function convertToWorkflowNode(record: RecordModel): WorkflowNode {
    return {
        id: record.id,
        workflow_id: record.workflow_id,
        type: record.type,
        node_type: record.node_type,
        label: record.label || record.node_type,
        config: record.config || '{}',
        position_x: record.position_x ?? 0,
        position_y: record.position_y ?? 0
    };
}

function convertToWorkflowConnection(record: RecordModel): WorkflowConnection {
    return {
        id: record.id,
        workflow_id: record.workflow_id,
        source_id: record.source_id,
        target_id: record.target_id
    };
}

class WorkflowServiceImpl {
    async fetchWorkflows(
        page: number = 1,
        perPage: number = 50,
        options?: {
            searchQuery?: string;
            active?: boolean;
        }
    ): Promise<{
        items: Workflow[];
        totalItems: number;
        page: number;
        perPage: number;
    } | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const filterBuilder = FilterBuilder.create();

            if (options?.searchQuery?.trim()) {
                const searchTerm = options.searchQuery.trim();
                const escapedTerm = searchTerm.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                filterBuilder.or(
                    `name ~ "${escapedTerm}"`,
                    `description ~ "${escapedTerm}"`
                );
            }

            if (options?.active !== undefined) {
                filterBuilder.equals('active', options.active);
            }

            const filter = filterBuilder.build();

            const response = await pb.collection(COLLECTIONS.WORKFLOWS).getList(page, perPage, {
                sort: '-updated',
                filter: filter || undefined
            });

            const items = response.items.map(convertToWorkflow);

            return {
                items,
                totalItems: response.totalItems,
                page: response.page,
                perPage: response.perPage
            };
        } catch (error) {
            console.error('Failed to fetch workflows:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async getWorkflow(id: string): Promise<Workflow | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const record = await pb.collection(COLLECTIONS.WORKFLOWS).getOne(id);
            NetworkService.reportSuccess();
            return convertToWorkflow(record);
        } catch (error) {
            console.error('Failed to get workflow:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async createWorkflow(data: Omit<Workflow, 'id' | 'created' | 'updated'>): Promise<Workflow | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const record = await pb.collection(COLLECTIONS.WORKFLOWS).create({
                name: data.name,
                description: data.description,
                active: data.active,
                user: data.user,
                config: data.config || {},
                timeout: data.timeout ?? 3600,
                max_retries: data.max_retries ?? 0,
                retry_delay: data.retry_delay ?? 1
            });

            NetworkService.reportSuccess();
            return convertToWorkflow(record);
        } catch (error) {
            console.error('Failed to create workflow:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async updateWorkflow(id: string, data: Partial<Omit<Workflow, 'id' | 'created' | 'updated'>>): Promise<Workflow | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const record = await pb.collection(COLLECTIONS.WORKFLOWS).update(id, data);
            NetworkService.reportSuccess();
            return convertToWorkflow(record);
        } catch (error) {
            console.error('Failed to update workflow:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async deleteWorkflow(id: string): Promise<boolean> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            await pb.collection(COLLECTIONS.WORKFLOWS).delete(id);
            NetworkService.reportSuccess();
            return true;
        } catch (error) {
            console.error('Failed to delete workflow:', error);
            NetworkService.reportFailure();
            return false;
        }
    }

    async getWorkflowGraph(workflowId: string): Promise<{
        nodes: WorkflowNode[];
        connections: WorkflowConnection[];
    } | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const response = await pb.send(`/api/workflows/workflow/${workflowId}/graph`, {
                method: 'GET'
            }) as any;

            NetworkService.reportSuccess();

            const responseData = response.data || response;

            return {
                nodes: (responseData.nodes || []).map(convertToWorkflowNode),
                connections: (responseData.connections || []).map(convertToWorkflowConnection)
            };
        } catch (error) {
            console.error('Failed to get workflow graph:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async getWorkflowNodes(workflowId: string): Promise<WorkflowNode[]> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const response = await pb.collection(COLLECTIONS.WORKFLOW_NODES).getList(1, 500, {
                filter: `workflow_id = "${workflowId}"`
            });

            NetworkService.reportSuccess();
            return response.items.map(convertToWorkflowNode);
        } catch (error) {
            console.error('Failed to get workflow nodes:', error);
            NetworkService.reportFailure();
            return [];
        }
    }

    async createWorkflowNode(data: Omit<WorkflowNode, 'id' | 'created' | 'updated'>): Promise<WorkflowNode | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const record = await pb.collection(COLLECTIONS.WORKFLOW_NODES).create({
                workflow_id: data.workflow_id,
                type: data.type,
                node_type: data.node_type,
                label: data.label,
                config: data.config,
                position_x: data.position_x,
                position_y: data.position_y
            });

            NetworkService.reportSuccess();
            return convertToWorkflowNode(record);
        } catch (error) {
            console.error('Failed to create workflow node:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async updateWorkflowNode(id: string, data: Partial<Omit<WorkflowNode, 'id' | 'created' | 'updated'>>): Promise<WorkflowNode | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const record = await pb.collection(COLLECTIONS.WORKFLOW_NODES).update(id, data);
            NetworkService.reportSuccess();
            return convertToWorkflowNode(record);
        } catch (error) {
            console.error('Failed to update workflow node:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async deleteWorkflowNode(id: string): Promise<boolean> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            await pb.collection(COLLECTIONS.WORKFLOW_NODES).delete(id);
            NetworkService.reportSuccess();
            return true;
        } catch (error) {
            console.error('Failed to delete workflow node:', error);
            NetworkService.reportFailure();
            return false;
        }
    }

    async getWorkflowConnections(workflowId: string): Promise<WorkflowConnection[]> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const response = await pb.collection(COLLECTIONS.WORKFLOW_CONNECTIONS).getList(1, 500, {
                filter: `workflow_id = "${workflowId}"`
            });

            NetworkService.reportSuccess();
            return response.items.map(convertToWorkflowConnection);
        } catch (error) {
            console.error('Failed to get workflow connections:', error);
            NetworkService.reportFailure();
            return [];
        }
    }

    async createWorkflowConnection(data: Omit<WorkflowConnection, 'id' | 'created' | 'updated'>): Promise<WorkflowConnection | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const record = await pb.collection(COLLECTIONS.WORKFLOW_CONNECTIONS).create({
                workflow_id: data.workflow_id,
                source_id: data.source_id,
                target_id: data.target_id
            });

            NetworkService.reportSuccess();
            return convertToWorkflowConnection(record);
        } catch (error) {
            console.error('Failed to create workflow connection:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async deleteWorkflowConnection(id: string): Promise<boolean> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            await pb.collection(COLLECTIONS.WORKFLOW_CONNECTIONS).delete(id);
            NetworkService.reportSuccess();
            return true;
        } catch (error) {
            console.error('Failed to delete workflow connection:', error);
            NetworkService.reportFailure();
            return false;
        }
    }

    async saveWorkflowGraph(
        workflowId: string,
        nodes: FlowNode[],
        edges: FlowEdge[]
    ): Promise<{
        nodes: WorkflowNode[];
        connections: WorkflowConnection[];
        validation: ValidationResult;
    } | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const backendNodes = nodes.map(node => ({
                id: node.id || null,
                type: node.data.workflowNodeType,
                node_type: node.data.nodeType,
                name: node.data.label,
                config: node.data.config || {},
                position: {
                    x: node.position.x,
                    y: node.position.y
                }
            }));
            
            // Log config for PocketBase sources to verify collection is included
            const pocketbaseNodes = backendNodes.filter(n => 
                n.node_type?.toLowerCase().includes('pocketbase')
            );
            if (pocketbaseNodes.length > 0) {
                console.log('💾 Saving PocketBase nodes with config:', pocketbaseNodes.map(n => ({
                    id: n.id,
                    node_type: n.node_type,
                    collection: n.config?.collection
                })));
            }

            const backendConnections = edges.map(edge => ({
                id: edge.id || null,
                source: edge.source,
                target: edge.target
            }));

            const response = await pb.send(`/api/workflows/workflow/${workflowId}/graph`, {
                method: 'PUT',
                body: {
                    nodes: backendNodes,
                    connections: backendConnections
                }
            }) as any;

            NetworkService.reportSuccess();

            const responseData = response.data || response;

            return {
                nodes: responseData.nodes || [],
                connections: responseData.connections || [],
                validation: responseData.validation || { valid: true, errors: [], warnings: [] }
            };
        } catch (error) {
            console.error('Failed to save workflow graph:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async getConnectors(): Promise<Connector[]> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const response = await pb.send('/api/workflows/connectors', {
                method: 'GET'
            });

            NetworkService.reportSuccess();
            return response.connectors || [];
        } catch (error) {
            console.error('Failed to get connectors:', error);
            NetworkService.reportFailure();
            return [];
        }
    }

    async validateWorkflow(workflowId: string): Promise<ValidationResult | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const response = await pb.send(`/api/workflows/${workflowId}/validate`, {
                method: 'POST'
            });

            NetworkService.reportSuccess();
            return response;
        } catch (error) {
            console.error('Failed to validate workflow:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async executeWorkflow(workflowId: string): Promise<{ id: string } | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const response = await pb.send(`/api/workflows/${workflowId}/execute`, {
                method: 'POST'
            }) as any;

            NetworkService.reportSuccess();
            
            // Backend returns { success: true, data: { id: ..., workflow_id: ..., ... } }
            const execution = response.data || response;
            
            // Return execution with id field (execution object has id from BaseModel)
            if (execution && execution.id) {
                return { id: execution.id };
            }
            
            console.error('Invalid execution response:', response);
            return null;
        } catch (error) {
            console.error('Failed to execute workflow:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async getPocketBaseCollections(): Promise<Array<{ id: string; name: string; type: string }> | null> {
        try {
            const response = await pb.send('/api/workflows/pocketbase/collections', {
                method: 'GET'
            });
            NetworkService.reportSuccess();
            // Backend returns { success: true, data: { collections: [...] } }
            return (response.data?.collections || response.collections || []) as Array<{ id: string; name: string; type: string }>;
        } catch (error) {
            console.error('Failed to fetch PocketBase collections:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async getPocketBaseCollectionSchema(collectionName: string): Promise<{ collection: string; fields: Array<{ name: string; type: string; required: boolean; default?: any }> } | null> {
        try {
            const response = await pb.send(`/api/workflows/pocketbase/collections/${encodeURIComponent(collectionName)}/schema`, {
                method: 'GET'
            });
            NetworkService.reportSuccess();
            // Backend returns { success: true, data: { collection: "...", fields: [...] } }
            return (response.data || response) as { collection: string; fields: Array<{ name: string; type: string; required: boolean; default?: any }> };
        } catch (error) {
            console.error('Failed to fetch PocketBase collection schema:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async getPocketBaseCollectionCount(collectionName: string): Promise<number | null> {
        try {
            const response = await pb.send(`/api/workflows/pocketbase/collections/${encodeURIComponent(collectionName)}/count`, {
                method: 'GET'
            });
            NetworkService.reportSuccess();
            // Backend returns { success: true, data: { collection: "...", count: 123 } }
            const data = response.data || response;
            return (data as { collection: string; count: number }).count;
        } catch (error) {
            console.error('Failed to fetch PocketBase collection count:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async getNodeOutputSchema(workflowId: string, nodeId: string): Promise<DataSchema | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const response = await pb.send(`/api/workflows/workflow/${workflowId}/nodes/${nodeId}/schema/output`, {
                method: 'GET'
            }) as any;

            NetworkService.reportSuccess();
            const data = response.data || response;
            return (data as { output_schema: DataSchema }).output_schema;
        } catch (error: any) {
            // Don't log 400 errors for nodes without upstream connections - this is expected
            if (error?.status !== 400) {
                console.error('Failed to get node output schema:', error);
            }
            NetworkService.reportFailure();
            return null;
        }
    }

    async getNodeSampleData(workflowId: string, nodeId: string, limit: number = 20): Promise<DataEnvelope | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const response = await pb.send(`/api/workflows/workflow/${workflowId}/nodes/${nodeId}/sample?limit=${limit}`, {
                method: 'GET'
            }) as any;

            NetworkService.reportSuccess();
            const data = response.data || response;
            // Convert to DataEnvelope format
            return data as DataEnvelope;
        } catch (error: any) {
            // Don't log 400 errors for nodes without upstream connections - this is expected
            if (error?.status !== 400) {
                console.error('Failed to get node sample data:', error);
            }
            NetworkService.reportFailure();
            return null;
        }
    }
}

export const WorkflowService = new WorkflowServiceImpl();


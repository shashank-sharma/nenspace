import { browser } from '$app/environment';
import { pb } from '$lib/config/pocketbase';
import { NetworkService } from '$lib/services/network.service.svelte';
import { FilterBuilder, withErrorHandling } from '$lib/utils';
import type { Workflow, WorkflowNode, WorkflowConnection, Connector, ValidationResult, FlowNode, FlowEdge, DataSchema, DataEnvelope } from '../types';
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
    #cache = new Map<string, Workflow>();

    #unwrapResponse<T>(response: any, dataKey?: string): T {
        if (dataKey && response?.[dataKey]) {
            return response[dataKey];
        }
        return response?.data || response;
    }

    getCachedWorkflow(id: string): Workflow | undefined {
        return this.#cache.get(id);
    }

    clearCache() {
        this.#cache.clear();
    }

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
        return await withErrorHandling(
            async () => {
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

                items.forEach((item) => {
                    this.#cache.set(item.id, item);
                });

                return {
                    items,
                    totalItems: response.totalItems,
                    page: response.page,
                    perPage: response.perPage
                };
            },
            {
                errorMessage: 'Failed to fetch workflows',
                showToast: false,
                logErrors: true
            }
        );
    }

    async getWorkflow(id: string): Promise<Workflow | null> {
        const cached = this.#cache.get(id);
        if (cached) {
            return cached;
        }

        const workflow = await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                const record = await pb.collection(COLLECTIONS.WORKFLOWS).getOne(id);
                NetworkService.reportSuccess();
                return convertToWorkflow(record);
            },
            {
                errorMessage: 'Failed to get workflow',
                showToast: false,
                logErrors: true
            }
        );

        if (workflow) {
            this.#cache.set(id, workflow);
        }

        return workflow;
    }

    async createWorkflow(data: Omit<Workflow, 'id' | 'created' | 'updated'>): Promise<Workflow | null> {
        const workflow = await withErrorHandling(
            async () => {
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
            },
            {
                errorMessage: 'Failed to create workflow',
                showToast: false,
                logErrors: true
            }
        );

        if (workflow) {
            this.#cache.set(workflow.id, workflow);
        }

        return workflow;
    }

    async updateWorkflow(id: string, data: Partial<Omit<Workflow, 'id' | 'created' | 'updated'>>): Promise<Workflow | null> {
        const workflow = await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                const record = await pb.collection(COLLECTIONS.WORKFLOWS).update(id, data);
                NetworkService.reportSuccess();
                return convertToWorkflow(record);
            },
            {
                errorMessage: 'Failed to update workflow',
                showToast: false,
                logErrors: true
            }
        );

        if (workflow) {
            this.#cache.set(id, workflow);
        }

        return workflow;
    }

    async deleteWorkflow(id: string): Promise<boolean> {
        const result = await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                await pb.collection(COLLECTIONS.WORKFLOWS).delete(id);
                NetworkService.reportSuccess();
                return true;
            },
            {
                errorMessage: 'Failed to delete workflow',
                showToast: false,
                logErrors: true
            }
        );

        if (result) {
            this.#cache.delete(id);
        }

        return result ?? false;
    }

    async getWorkflowGraph(workflowId: string): Promise<{
        nodes: WorkflowNode[];
        connections: WorkflowConnection[];
    } | null> {
        return await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                const response = await pb.send(`/api/workflows/workflow/${workflowId}/graph`, {
                    method: 'GET'
                }) as any;

                NetworkService.reportSuccess();

                const responseData = this.#unwrapResponse(response);

                return {
                    nodes: (responseData.nodes || []).map(convertToWorkflowNode),
                    connections: (responseData.connections || []).map(convertToWorkflowConnection)
                };
            },
            {
                errorMessage: 'Failed to get workflow graph',
                showToast: false,
                logErrors: true
            }
        );
    }

    async getWorkflowNodes(workflowId: string): Promise<WorkflowNode[] | null> {
        return await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                const response = await pb.collection(COLLECTIONS.WORKFLOW_NODES).getList(1, 500, {
                    filter: `workflow_id = "${workflowId}"`
                });

                NetworkService.reportSuccess();
                return response.items.map(convertToWorkflowNode);
            },
            {
                errorMessage: 'Failed to get workflow nodes',
                showToast: false,
                logErrors: true
            }
        );
    }

    async createWorkflowNode(data: Omit<WorkflowNode, 'id' | 'created' | 'updated'>): Promise<WorkflowNode | null> {
        return await withErrorHandling(
            async () => {
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
            },
            {
                errorMessage: 'Failed to create workflow node',
                showToast: false,
                logErrors: true
            }
        );
    }

    async updateWorkflowNode(id: string, data: Partial<Omit<WorkflowNode, 'id' | 'created' | 'updated'>>): Promise<WorkflowNode | null> {
        return await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                const record = await pb.collection(COLLECTIONS.WORKFLOW_NODES).update(id, data);
                NetworkService.reportSuccess();
                return convertToWorkflowNode(record);
            },
            {
                errorMessage: 'Failed to update workflow node',
                showToast: false,
                logErrors: true
            }
        );
    }

    async deleteWorkflowNode(id: string): Promise<boolean> {
        const result = await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                await pb.collection(COLLECTIONS.WORKFLOW_NODES).delete(id);
                NetworkService.reportSuccess();
                return true;
            },
            {
                errorMessage: 'Failed to delete workflow node',
                showToast: false,
                logErrors: true
            }
        );

        return result ?? false;
    }

    async getWorkflowConnections(workflowId: string): Promise<WorkflowConnection[] | null> {
        return await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                const response = await pb.collection(COLLECTIONS.WORKFLOW_CONNECTIONS).getList(1, 500, {
                    filter: `workflow_id = "${workflowId}"`
                });

                NetworkService.reportSuccess();
                return response.items.map(convertToWorkflowConnection);
            },
            {
                errorMessage: 'Failed to get workflow connections',
                showToast: false,
                logErrors: true
            }
        );
    }

    async createWorkflowConnection(data: Omit<WorkflowConnection, 'id' | 'created' | 'updated'>): Promise<WorkflowConnection | null> {
        return await withErrorHandling(
            async () => {
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
            },
            {
                errorMessage: 'Failed to create workflow connection',
                showToast: false,
                logErrors: true
            }
        );
    }

    async deleteWorkflowConnection(id: string): Promise<boolean> {
        const result = await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                await pb.collection(COLLECTIONS.WORKFLOW_CONNECTIONS).delete(id);
                NetworkService.reportSuccess();
                return true;
            },
            {
                errorMessage: 'Failed to delete workflow connection',
                showToast: false,
                logErrors: true
            }
        );

        return result ?? false;
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
        return await withErrorHandling(
            async () => {
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

                const responseData = this.#unwrapResponse(response);

                return {
                    nodes: responseData.nodes || [],
                    connections: responseData.connections || [],
                    validation: responseData.validation || { valid: true, errors: [], warnings: [] }
                };
            },
            {
                errorMessage: 'Failed to save workflow graph',
                showToast: false,
                logErrors: true
            }
        );
    }

    async getConnectors(): Promise<Connector[] | null> {
        return await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                const response = await pb.send('/api/workflows/connectors', {
                    method: 'GET'
                });

                NetworkService.reportSuccess();
                return response.connectors || [];
            },
            {
                errorMessage: 'Failed to get connectors',
                showToast: false,
                logErrors: true
            }
        );
    }

    async validateWorkflow(workflowId: string): Promise<ValidationResult | null> {
        return await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                const response = await pb.send(`/api/workflows/${workflowId}/validate`, {
                    method: 'POST'
                });

                NetworkService.reportSuccess();
                return response;
            },
            {
                errorMessage: 'Failed to validate workflow',
                showToast: false,
                logErrors: true
            }
        );
    }

    async executeWorkflow(workflowId: string): Promise<{ id: string } | null> {
        return await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                const response = await pb.send(`/api/workflows/${workflowId}/execute`, {
                    method: 'POST'
                }) as any;

                NetworkService.reportSuccess();
                
                const execution = this.#unwrapResponse(response);
                
                if (execution && execution.id) {
                    return { id: execution.id };
                }
                
                throw new Error('Invalid execution response');
            },
            {
                errorMessage: 'Failed to execute workflow',
                showToast: false,
                logErrors: true
            }
        );
    }

    async getPocketBaseCollections(): Promise<Array<{ id: string; name: string; type: string }> | null> {
        return await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                const response = await pb.send('/api/workflows/pocketbase/collections', {
                    method: 'GET'
                });
                NetworkService.reportSuccess();
                const data = this.#unwrapResponse(response, 'collections');
                return (data?.collections || data || []) as Array<{ id: string; name: string; type: string }>;
            },
            {
                errorMessage: 'Failed to fetch PocketBase collections',
                showToast: false,
                logErrors: true
            }
        );
    }

    async getPocketBaseCollectionSchema(collectionName: string): Promise<{ collection: string; fields: Array<{ name: string; type: string; required: boolean; default?: any }> } | null> {
        return await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                const response = await pb.send(`/api/workflows/pocketbase/collections/${encodeURIComponent(collectionName)}/schema`, {
                    method: 'GET'
                });
                NetworkService.reportSuccess();
                return this.#unwrapResponse(response) as { collection: string; fields: Array<{ name: string; type: string; required: boolean; default?: any }> };
            },
            {
                errorMessage: 'Failed to fetch PocketBase collection schema',
                showToast: false,
                logErrors: true
            }
        );
    }

    async getPocketBaseCollectionCount(collectionName: string): Promise<number | null> {
        return await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                const response = await pb.send(`/api/workflows/pocketbase/collections/${encodeURIComponent(collectionName)}/count`, {
                    method: 'GET'
                });
                NetworkService.reportSuccess();
                const data = this.#unwrapResponse(response);
                return (data as { collection: string; count: number }).count;
            },
            {
                errorMessage: 'Failed to fetch PocketBase collection count',
                showToast: false,
                logErrors: true
            }
        );
    }

    async getNodeOutputSchema(workflowId: string, nodeId: string): Promise<DataSchema | null> {
        if (!NetworkService.isOnline) {
            return null;
        }

        try {
            const response = await pb.send(`/api/workflows/workflow/${workflowId}/nodes/${nodeId}/schema/output`, {
                method: 'GET'
            }) as any;

            NetworkService.reportSuccess();
            const data = this.#unwrapResponse(response);
            return (data as { output_schema: DataSchema }).output_schema;
        } catch (error: any) {
            if (error?.status === 400) {
                return null;
            }
            return await withErrorHandling(
                async () => {
                    throw error;
                },
                {
                    errorMessage: 'Failed to get node output schema',
                    showToast: false,
                    logErrors: true
                }
            );
        }
    }

    async getNodeSampleData(workflowId: string, nodeId: string, limit: number = 20): Promise<DataEnvelope | null> {
        if (!NetworkService.isOnline) {
            return null;
        }

        try {
            const response = await pb.send(`/api/workflows/workflow/${workflowId}/nodes/${nodeId}/sample?limit=${limit}`, {
                method: 'GET'
            }) as any;

            NetworkService.reportSuccess();
            const data = this.#unwrapResponse(response);
            return data as DataEnvelope;
        } catch (error: any) {
            if (error?.status === 400) {
                return null;
            }
            return await withErrorHandling(
                async () => {
                    throw error;
                },
                {
                    errorMessage: 'Failed to get node sample data',
                    showToast: false,
                    logErrors: true
                }
            );
        }
    }

    async getNodeInputSchema(workflowId: string, nodeId: string): Promise<DataSchema | null> {
        if (!NetworkService.isOnline) {
            return null;
        }

        try {
            const response = await pb.send(`/api/workflows/workflow/${workflowId}/nodes/${nodeId}/schema/input`, {
                method: 'GET'
            }) as any;

            NetworkService.reportSuccess();
            const data = this.#unwrapResponse(response);
            return (data as { input_schema: DataSchema }).input_schema;
        } catch (error: any) {
            if (error?.status === 400) {
                return null;
            }
            return await withErrorHandling(
                async () => {
                    throw error;
                },
                {
                    errorMessage: 'Failed to get node input schema',
                    showToast: false,
                    logErrors: true
                }
            );
        }
    }
}

export const WorkflowService = new WorkflowServiceImpl();


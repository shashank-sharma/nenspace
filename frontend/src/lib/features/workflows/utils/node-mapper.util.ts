import type { WorkflowNode, WorkflowConnection, FlowNode, FlowEdge } from '../types';

export function workflowNodeToFlowNode(node: WorkflowNode): FlowNode {
    let config = {};
    if (node.config) {
        try {
            config = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
        } catch {
            config = {};
        }
    }

    return {
        id: node.id,
        type: `workflow-${node.type}`,
        position: { x: node.position_x, y: node.position_y },
        data: {
            label: node.label || node.node_type,
            nodeType: node.node_type,
            config,
            workflowNodeType: node.type
        }
    };
}

export function flowNodeToWorkflowNode(
    flowNode: FlowNode,
    workflowId: string
): Omit<WorkflowNode, 'id' | 'created' | 'updated'> {
    return {
        workflow_id: workflowId,
        type: flowNode.data.workflowNodeType,
        node_type: flowNode.data.nodeType,
        label: flowNode.data.label,
        config: JSON.stringify(flowNode.data.config || {}),
        position_x: Math.round(flowNode.position.x),
        position_y: Math.round(flowNode.position.y)
    };
}

export function workflowConnectionToFlowEdge(connection: WorkflowConnection): FlowEdge {
    return {
        id: connection.id,
        source: connection.source_id,
        target: connection.target_id
    };
}

export function flowEdgeToWorkflowConnection(
    edge: FlowEdge,
    workflowId: string
): Omit<WorkflowConnection, 'id' | 'created' | 'updated'> {
    return {
        workflow_id: workflowId,
        source_id: edge.source,
        target_id: edge.target
    };
}

export function generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateEdgeId(): string {
    return `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}


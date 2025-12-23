import type { FlowNode, FlowEdge, ValidationResult } from '../types';
import { NODE_TYPES } from '../constants';

export function validateWorkflowGraph(
    nodes: FlowNode[],
    edges: FlowEdge[],
    connectors: Map<string, { type: string }>
): ValidationResult {
    const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: []
    };

    if (nodes.length === 0) {
        result.valid = false;
        result.errors.push('Workflow must have at least one node');
        return result;
    }

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const hasSource = nodes.some(n => n.data.workflowNodeType === NODE_TYPES.SOURCE);
    const hasDestination = nodes.some(n => n.data.workflowNodeType === NODE_TYPES.DESTINATION);

    if (!hasSource) {
        result.valid = false;
        result.errors.push('Workflow must have at least one source node');
    }

    if (!hasDestination) {
        result.valid = false;
        result.errors.push('Workflow must have at least one destination node');
    }

    for (const node of nodes) {
        if (!node.data.nodeType) {
            result.valid = false;
            result.errors.push(`Node ${node.id} has no connector type`);
            continue;
        }

        const connector = connectors.get(node.data.nodeType);
        if (!connector) {
            result.valid = false;
            result.errors.push(`Node ${node.id} uses unknown connector type: ${node.data.nodeType}`);
            continue;
        }

        if (node.data.workflowNodeType !== connector.type && !(node.data.workflowNodeType === NODE_TYPES.PROCESSOR && connector.type === NODE_TYPES.PROCESSOR)) {
            result.valid = false;
            result.errors.push(`Node ${node.id} type mismatch: expected ${connector.type}, got ${node.data.workflowNodeType}`);
        }
    }

    for (const edge of edges) {
        if (!nodeMap.has(edge.source)) {
            result.valid = false;
            result.errors.push(`Edge references non-existent source node: ${edge.source}`);
        }
        if (!nodeMap.has(edge.target)) {
            result.valid = false;
            result.errors.push(`Edge references non-existent target node: ${edge.target}`);
        }

        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);

        if (sourceNode && targetNode) {
            if (sourceNode.data.workflowNodeType === NODE_TYPES.DESTINATION) {
                result.valid = false;
                result.errors.push(`Destination node ${edge.source} cannot have outgoing connections`);
            }
            if (targetNode.data.workflowNodeType === NODE_TYPES.SOURCE) {
                result.valid = false;
                result.errors.push(`Source node ${edge.target} cannot have incoming connections`);
            }
        }
    }

    const hasCircular = detectCircularDependency(nodes, edges);
    if (hasCircular) {
        result.valid = false;
        result.errors.push('Workflow contains circular dependencies');
    }

    const reachableNodes = findReachableNodes(nodes, edges);
    if (reachableNodes.size < nodes.length) {
        for (const node of nodes) {
            if (!reachableNodes.has(node.id)) {
                result.warnings.push(`Node ${node.id} is not reachable from any source node`);
            }
        }
    }

    return result;
}

function detectCircularDependency(nodes: FlowNode[], edges: FlowEdge[]): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const adjList = new Map<string, string[]>();

    for (const edge of edges) {
        if (!adjList.has(edge.source)) {
            adjList.set(edge.source, []);
        }
        adjList.get(edge.source)!.push(edge.target);
    }

    function hasCycle(nodeId: string): boolean {
        visited.add(nodeId);
        recStack.add(nodeId);

        const neighbors = adjList.get(nodeId) || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                if (hasCycle(neighbor)) {
                    return true;
                }
            } else if (recStack.has(neighbor)) {
                return true;
            }
        }

        recStack.delete(nodeId);
        return false;
    }

    for (const node of nodes) {
        if (!visited.has(node.id)) {
            if (hasCycle(node.id)) {
                return true;
            }
        }
    }

    return false;
}

function findReachableNodes(nodes: FlowNode[], edges: FlowEdge[]): Set<string> {
    const reachable = new Set<string>();
    const adjList = new Map<string, string[]>();

    for (const edge of edges) {
        if (!adjList.has(edge.source)) {
            adjList.set(edge.source, []);
        }
        adjList.get(edge.source)!.push(edge.target);
    }

    function dfs(nodeId: string) {
        if (reachable.has(nodeId)) {
            return;
        }
        reachable.add(nodeId);
        const neighbors = adjList.get(nodeId) || [];
        for (const neighbor of neighbors) {
            dfs(neighbor);
        }
    }

    for (const node of nodes) {
        if (node.data.workflowNodeType === NODE_TYPES.SOURCE) {
            dfs(node.id);
        }
    }

    return reachable;
}


import type { FlowNode, FlowEdge } from '../types';

export function topologicalSortNodes(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
    if (nodes.length === 0) return [];

    const dependents = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
        inDegree.set(node.id, 0);
        dependents.set(node.id, []);
    }

    for (const edge of edges) {
        const sourceId = edge.source;
        const targetId = edge.target;

        inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1);

        const sourceDependents = dependents.get(sourceId) || [];
        sourceDependents.push(targetId);
        dependents.set(sourceId, sourceDependents);
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
        if (degree === 0) {
            queue.push(nodeId);
        }
    }

    const result: FlowNode[] = [];
    const nodeMap = new Map<string, FlowNode>();
    for (const node of nodes) {
        nodeMap.set(node.id, node);
    }

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        const currentNode = nodeMap.get(currentId);

        if (currentNode) {
            result.push(currentNode);
        }

        const currentDependents = dependents.get(currentId) || [];
        for (const dependentId of currentDependents) {
            const newDegree = (inDegree.get(dependentId) || 0) - 1;
            inDegree.set(dependentId, newDegree);

            if (newDegree === 0) {
                queue.push(dependentId);
            }
        }
    }

    if (result.length < nodes.length) {
        const processedIds = new Set(result.map(n => n.id));
        for (const node of nodes) {
            if (!processedIds.has(node.id)) {
                result.push(node);
            }
        }
    }

    return result;
}

export function groupNodesByLevel(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[][] {
    const sorted = topologicalSortNodes(nodes, edges);
    const levels: FlowNode[][] = [];
    const nodeLevel = new Map<string, number>();

    const dependents = new Map<string, string[]>();
    for (const edge of edges) {
        const sourceDependents = dependents.get(edge.source) || [];
        sourceDependents.push(edge.target);
        dependents.set(edge.source, sourceDependents);
    }

    for (const node of sorted) {
        const upstreamNodes = edges
            .filter(e => e.target === node.id)
            .map(e => e.source);

        if (upstreamNodes.length === 0) {

            nodeLevel.set(node.id, 0);
        } else {

            const upstreamLevels = upstreamNodes
                .map(id => nodeLevel.get(id) ?? -1)
                .filter(level => level >= 0);

            const level = upstreamLevels.length > 0
                ? Math.max(...upstreamLevels) + 1
                : 0;
            nodeLevel.set(node.id, level);
        }
    }

    for (const node of sorted) {
        const level = nodeLevel.get(node.id) ?? 0;
        if (!levels[level]) {
            levels[level] = [];
        }
        levels[level].push(node);
    }

    return levels;
}


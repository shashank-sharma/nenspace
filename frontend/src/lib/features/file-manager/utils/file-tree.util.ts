import type { FolderRecord, FileTreeNode } from '../types';

export function buildFolderTree(folders: FolderRecord[]): FileTreeNode[] {
    const folderMap = new Map<string, FileTreeNode>();
    const rootNodes: FileTreeNode[] = [];

    folders.forEach(folder => {
        folderMap.set(folder.id, {
            id: folder.id,
            name: folder.name,
            parent: folder.parent,
            children: [],
            level: 0,
            expanded: false
        });
    });

    folders.forEach(folder => {
        const node = folderMap.get(folder.id)!;
        if (folder.parent) {
            const parent = folderMap.get(folder.parent);
            if (parent) {
                parent.children.push(node);
                node.level = parent.level + 1;
            } else {
                rootNodes.push(node);
            }
        } else {
            rootNodes.push(node);
        }
    });

    const sortNodes = (nodes: FileTreeNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name));
        nodes.forEach(node => {
            if (node.children.length > 0) {
                sortNodes(node.children);
            }
        });
    };

    sortNodes(rootNodes);
    return rootNodes;
}

export function flattenTree(nodes: FileTreeNode[]): FileTreeNode[] {
    const result: FileTreeNode[] = [];

    function traverse(node: FileTreeNode) {
        result.push(node);
        if (node.expanded && node.children.length > 0) {
            node.children.forEach(child => traverse(child));
        }
    }

    nodes.forEach(node => traverse(node));
    return result;
}

export function findNodeInTree(nodes: FileTreeNode[], id: string): FileTreeNode | null {
    for (const node of nodes) {
        if (node.id === id) {
            return node;
        }
        const found = findNodeInTree(node.children, id);
        if (found) {
            return found;
        }
    }
    return null;
}

export function getNodePath(nodes: FileTreeNode[], id: string): FileTreeNode[] {
    const path: FileTreeNode[] = [];

    function findPath(node: FileTreeNode, targetId: string): boolean {
        path.push(node);
        if (node.id === targetId) {
            return true;
        }
        for (const child of node.children) {
            if (findPath(child, targetId)) {
                return true;
            }
        }
        path.pop();
        return false;
    }

    for (const node of nodes) {
        if (findPath(node, id)) {
            return path;
        }
    }

    return [];
}


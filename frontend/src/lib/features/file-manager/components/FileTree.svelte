<script lang="ts">
    import { fileManagerStore } from '../stores/file-manager.store.svelte';
    import { buildFolderTree } from '../utils/file-tree.util';
    import FileTreeItem from './FileTreeItem.svelte';
    import { Home, FolderPlus, Folder, Check, X } from 'lucide-svelte';
    import { Button } from '$lib/components/ui/button';
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher<{
        createFolder: { name: string; parentId?: string };
        createNestedFolder: { name: string; parentId: string };
    }>();

    const folderTree = $derived(buildFolderTree(fileManagerStore.allFolders));
    let expandedFolders = $state<Set<string>>(new Set());
    let lastExpandedFolderId = $state<string | undefined>(undefined);
    let isCreatingFolder = $state(false);
    let newFolderName = $state('');
    let newFolderInputRef: HTMLInputElement | null = null;
    let nestedFolderParentId = $state<string | undefined>(undefined);

    function handleFolderSelect(folderId: string) {
        fileManagerStore.navigateToFolder(folderId);
    }

    function handleCreateNestedFolder(parentId: string) {
        nestedFolderParentId = parentId;
        handleShowCreateFolder(parentId);
    }

    function handleRootSelect() {
        fileManagerStore.navigateToFolder(undefined);
    }

    function handleToggle(folderId: string) {
        if (expandedFolders.has(folderId)) {
            expandedFolders.delete(folderId);
        } else {
            expandedFolders.add(folderId);
        }
        expandedFolders = new Set(expandedFolders);

        const updateNodeExpanded = (nodes: typeof folderTree) => {
            nodes.forEach(node => {
                if (node.id === folderId) {
                    node.expanded = expandedFolders.has(folderId);
                }
                if (node.children.length > 0) {
                    updateNodeExpanded(node.children);
                }
            });
        };
        updateNodeExpanded(folderTree);
    }

    function expandToFolder(folderId: string) {

        if (lastExpandedFolderId === folderId && expandedFolders.has(folderId)) {
            return;
        }

        lastExpandedFolderId = folderId;

        const foldersToExpand: string[] = [];

        const findPath = (nodes: typeof folderTree, targetId: string, path: string[] = []): string[] | null => {
            for (const node of nodes) {
                const currentPath = [...path, node.id];
                if (node.id === targetId) {
                    return currentPath;
                }
                if (node.children.length > 0) {
                    const found = findPath(node.children, targetId, currentPath);
                    if (found) {
                        return found;
                    }
                }
            }
            return null;
        };

        const path = findPath(folderTree, folderId);
        if (path) {

            path.forEach(id => {
                if (!expandedFolders.has(id)) {
                    foldersToExpand.push(id);
                }
            });

            if (foldersToExpand.length > 0) {
                foldersToExpand.forEach(id => expandedFolders.add(id));
                expandedFolders = new Set(expandedFolders);
            }
        }
    }

    function handleCreateFolder(name: string) {
        if (!name.trim()) {
            isCreatingFolder = false;
            newFolderName = '';
            nestedFolderParentId = undefined;
            return;
        }
        if (nestedFolderParentId) {
            dispatch('createNestedFolder', { name: name.trim(), parentId: nestedFolderParentId });
        } else {
            dispatch('createFolder', { name: name.trim(), parentId: undefined });
        }
        isCreatingFolder = false;
        newFolderName = '';
        nestedFolderParentId = undefined;
    }

    function handleShowCreateFolder() {
        isCreatingFolder = true;
        newFolderName = '';
        setTimeout(() => {
            if (newFolderInputRef) {
                newFolderInputRef.focus();
                newFolderInputRef.select();
            }
        }, 0);
    }

    function handleCancelCreateFolder() {
        isCreatingFolder = false;
        newFolderName = '';
        nestedFolderParentId = undefined;
    }

    function handleNewFolderKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleCreateFolder(newFolderName);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            handleCancelCreateFolder();
        }
    }

    let previousSelectedFolderId = $state<string | undefined>(undefined);

    $effect(() => {
        const currentSelectedId = fileManagerStore.selectedFolderId;

        if (currentSelectedId && currentSelectedId !== previousSelectedFolderId) {
            previousSelectedFolderId = currentSelectedId;
            expandToFolder(currentSelectedId);
        } else if (!currentSelectedId && previousSelectedFolderId !== undefined) {
            previousSelectedFolderId = undefined;
        }
    });

    $effect(() => {
        const handleShowCreateFolderEvent = () => {
            handleShowCreateFolder();
        };

        const element = document.querySelector('[data-file-tree]');
        if (element) {
            element.addEventListener('showCreateFolder', handleShowCreateFolderEvent);
            return () => {
                element.removeEventListener('showCreateFolder', handleShowCreateFolderEvent);
            };
        }
    });
</script>

<div class="h-full flex flex-col border-r bg-muted/30" data-file-tree>
    <div class="p-2 border-b space-y-2">
        <Button
            variant={!fileManagerStore.selectedFolderId ? 'secondary' : 'ghost'}
            class="w-full justify-start"
            onclick={handleRootSelect}
        >
            <Home class="h-4 w-4 mr-2" />
            <span>All Files</span>
        </Button>
        <Button
            variant="ghost"
            class="w-full justify-start"
            onclick={handleShowCreateFolder}
            disabled={isCreatingFolder}
        >
            <FolderPlus class="h-4 w-4 mr-2" />
            <span>New Folder</span>
        </Button>
    </div>
    <div class="flex-1 overflow-y-auto p-2 space-y-1">
        {#if isCreatingFolder}
            <div class="select-none">
                <div class="flex items-center gap-1.5 w-full h-8 px-2 rounded-md border border-primary bg-primary/5">
                    <div class="w-4" />
                    <Folder class="h-4 w-4 text-primary flex-shrink-0" />
                    <input
                        bind:this={newFolderInputRef}
                        bind:value={newFolderName}
                        placeholder="Folder name..."
                        onkeydown={handleNewFolderKeyDown}
                        onblur={() => {
                            setTimeout(() => {
                                if (newFolderName.trim()) {
                                    handleCreateFolder(newFolderName);
                                } else {
                                    handleCancelCreateFolder();
                                }
                            }, 200);
                        }}
                        class="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                        type="text"
                    />
                    <button
                        class="p-0.5 hover:bg-accent rounded text-green-600 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        onclick={(e) => {
                            e.stopPropagation();
                            handleCreateFolder(newFolderName);
                        }}
                        disabled={!newFolderName.trim()}
                        title="Create folder (Enter)"
                    >
                        <Check class="h-3.5 w-3.5" />
                    </button>
                    <button
                        class="p-0.5 hover:bg-accent rounded text-red-600 hover:text-red-700"
                        onclick={(e) => {
                            e.stopPropagation();
                            handleCancelCreateFolder();
                        }}
                        title="Cancel (Escape)"
                    >
                        <X class="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        {/if}
        {#if folderTree.length === 0 && !isCreatingFolder}
            <p class="text-sm text-muted-foreground px-2 py-4 text-center">
                No folders yet
            </p>
        {:else}
            {#each folderTree as node (node.id)}
                <FileTreeItem
                    {node}
                    selectedFolderId={fileManagerStore.selectedFolderId}
                    isExpanded={expandedFolders.has(node.id)}
                    expandedFolders={expandedFolders}
                    onSelect={handleFolderSelect}
                    onToggle={handleToggle}
                    onCreateNestedFolder={handleCreateNestedFolder}
                />
            {/each}
        {/if}
    </div>
</div>


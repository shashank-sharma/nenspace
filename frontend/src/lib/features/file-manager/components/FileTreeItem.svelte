<script lang="ts">
    import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus } from 'lucide-svelte';
    import type { FileTreeNode } from '../types';
    import { Button } from '$lib/components/ui/button';
    import FileTreeItem from './FileTreeItem.svelte';

    let {
        node: nodeProp,
        selectedFolderId,
        isExpanded: isExpandedProp = false,
        expandedFolders = new Set<string>(),
        onSelect,
        onToggle,
        onCreateNestedFolder
    } = $props<{
        node: FileTreeNode;
        selectedFolderId?: string;
        isExpanded?: boolean;
        expandedFolders?: Set<string>;
        onSelect: (id: string) => void;
        onToggle: (id: string) => void;
        onCreateNestedFolder?: (parentId: string) => void;
    }>();

    let isHovered = $state(false);

    let node = $state(nodeProp);

    $effect(() => {
        node = nodeProp;
    });

    const isSelected = $derived(selectedFolderId === node.id);
    const hasChildren = $derived(node.children.length > 0);
    const isExpanded = $derived(isExpandedProp);

    let clickTimeout: ReturnType<typeof setTimeout> | null = null;

    function handleClick() {
        if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;

            onSelect(node.id);
        } else {

            clickTimeout = setTimeout(() => {
                clickTimeout = null;
            }, 300);
        }
    }
</script>

<div class="select-none">
    <div
        class="group relative"
        onmouseenter={() => isHovered = true}
        onmouseleave={() => isHovered = false}
    >
        <Button
            variant={isSelected ? 'secondary' : 'ghost'}
            class="w-full justify-start h-8 px-2"
            onclick={handleClick}
        >
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
                {#if hasChildren}
                    <button
                        class="p-0.5 hover:bg-accent rounded"
                        onclick={(e) => {
                            e.stopPropagation();
                            onToggle(node.id);
                        }}
                    >
                        {#if isExpanded}
                            <ChevronDown class="h-3 w-3" />
                        {:else}
                            <ChevronRight class="h-3 w-3" />
                        {/if}
                    </button>
                {:else}
                    <div class="w-4" />
                {/if}
                {#if isExpanded}
                    <FolderOpen class="h-4 w-4 text-primary flex-shrink-0" />
                {:else}
                    <Folder class="h-4 w-4 text-muted-foreground flex-shrink-0" />
                {/if}
                <span class="truncate text-sm">{node.name}</span>
                {#if isHovered && onCreateNestedFolder}
                    <button
                        class="ml-auto p-0.5 hover:bg-accent rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        onclick={(e) => {
                            e.stopPropagation();
                            onCreateNestedFolder(node.id);
                        }}
                        title="Create folder inside"
                    >
                        <Plus class="h-3 w-3" />
                    </button>
                {/if}
            </div>
        </Button>
    </div>
    {#if hasChildren && isExpanded}
        <div class="ml-4 mt-0.5">
            {#each node.children as child (child.id)}
                <FileTreeItem
                    node={child}
                    {selectedFolderId}
                    isExpanded={expandedFolders.has(child.id)}
                    {expandedFolders}
                    {onSelect}
                    {onToggle}
                    {onCreateNestedFolder}
                />
            {/each}
        </div>
    {/if}
</div>


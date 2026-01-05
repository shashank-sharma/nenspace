<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Plus, FolderPlus, Trash2, Download, Move } from 'lucide-svelte';
    import { createEventDispatcher } from 'svelte';

    let {
        selectedCount = 0,
        showUpload = true,
        showNewFolder = true
    } = $props<{
        selectedCount?: number;
        showUpload?: boolean;
        showNewFolder?: boolean;
    }>();

    const dispatch = createEventDispatcher<{
        upload: void;
        newFolder: void;
        deleteSelected: void;
        downloadSelected: void;
        moveSelected: void;
    }>();

    function handleUpload() {
        dispatch('upload');
    }

    function handleNewFolder() {
        dispatch('newFolder');
    }

    function handleDeleteSelected() {
        dispatch('deleteSelected');
    }

    function handleDownloadSelected() {
        dispatch('downloadSelected');
    }

    function handleMoveSelected() {
        dispatch('moveSelected');
    }
</script>

<div class="flex items-center justify-between p-4 border-b bg-card">
    <div class="flex items-center gap-2">
        {#if selectedCount > 0}
            <span class="text-sm text-muted-foreground">
                {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
            </span>
            <div class="flex gap-2 ml-4">
                <Button variant="outline" size="sm" onclick={handleDownloadSelected}>
                    <Download class="mr-2 h-4 w-4" />
                    Download
                </Button>
                <Button variant="outline" size="sm" onclick={handleMoveSelected}>
                    <Move class="mr-2 h-4 w-4" />
                    Move
                </Button>
                <Button variant="destructive" size="sm" onclick={handleDeleteSelected}>
                    <Trash2 class="mr-2 h-4 w-4" />
                    Delete
                </Button>
            </div>
        {:else}
            {#if showUpload}
                <Button size="sm" onclick={handleUpload}>
                    <Plus class="mr-2 h-4 w-4" />
                    Upload File
                </Button>
            {/if}
            {#if showNewFolder}
                <Button variant="outline" size="sm" onclick={handleNewFolder}>
                    <FolderPlus class="mr-2 h-4 w-4" />
                    New Folder
                </Button>
            {/if}
        {/if}
    </div>
</div>


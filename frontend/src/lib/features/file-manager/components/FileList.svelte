<script lang="ts">
    import FileCard from './FileCard.svelte';
    import FolderCard from './FolderCard.svelte';
    import type { FileRecord, FolderRecord } from '../types';
    import { FolderOpen } from 'lucide-svelte';
    import { createEventDispatcher, onMount } from 'svelte';
    import { animate, stagger, remove } from 'animejs';

    let {
        files,
        folders,
        viewMode = 'grid',
        selectedFiles = new Set<string>(),
        selectedFolders = new Set<string>(),
        showCheckboxes = false,
        isCreatingFolder = false,
        onCreateFolder
    } = $props<{
        files: FileRecord[];
        folders?: FolderRecord[];
        viewMode?: 'grid' | 'list';
        selectedFiles?: Set<string>;
        selectedFolders?: Set<string>;
        showCheckboxes?: boolean;
        isCreatingFolder?: boolean;
        onCreateFolder?: (name: string) => void;
    }>();

    let newFolderName = $state('');
    let newFolderInputRef: HTMLInputElement | null = null;
    let containerRef = $state<HTMLDivElement | null>(null);

    $effect(() => {
        if (isCreatingFolder && newFolderInputRef) {
            setTimeout(() => {
                if (newFolderInputRef) {
                    newFolderInputRef.focus();
                    newFolderInputRef.select();
                }
            }, 0);
        }
    });

    $effect(() => {
        const itemsCount = (files?.length || 0) + (folders?.length || 0);

        if (containerRef && itemsCount > 0) {
            setTimeout(() => {
                const items = containerRef?.querySelectorAll('.file-item-anim');
                if (items && items.length > 0) {
                    if (typeof remove === 'function') {
                        remove(items);
                    }

                    animate(items, {
                        opacity: 0,
                        translateY: 10,
                        scale: 0.98,
                        duration: 0
                    });

                    animate(items, {
                        opacity: [0, 1],
                        translateY: [10, 0],
                        scale: [0.98, 1],
                        delay: stagger(20),
                        duration: 400,
                        ease: 'outCubic'
                    });
                }
            }, 0);
        }

        return () => {
            if (containerRef) {
                const items = containerRef.querySelectorAll('.file-item-anim');
                if (typeof remove === 'function') {
                    remove(items);
                }
            }
        };
    });

    function handleCreateFolder() {
        const name = newFolderName.trim();
        if (name && onCreateFolder) {
            onCreateFolder(name);
            newFolderName = '';
        } else if (!name && onCreateFolder) {
            onCreateFolder('');
        }
    }

    function handleCancelCreateFolder() {
        newFolderName = '';
        if (onCreateFolder) {
            onCreateFolder('');
        }
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleCreateFolder();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            handleCancelCreateFolder();
        }
    }

    const dispatch = createEventDispatcher<{
        select: FileRecord | FolderRecord;
        delete: FileRecord;
        rename: FileRecord;
        preview: FileRecord;
        folderOpen: FolderRecord;
        folderDelete: FolderRecord;
        folderRename: FolderRecord;
        drop: DragEvent;
    }>();

    function handleFileSelect(event: CustomEvent<FileRecord>) {
        dispatch('select', event.detail);
    }

    function handleFolderSelect(event: CustomEvent<FolderRecord>) {
        dispatch('select', event.detail);
    }

    function handlePreview(event: CustomEvent<FileRecord>) {
        dispatch('preview', event.detail);
    }

    function handleDownload(event: CustomEvent<FileRecord>) {
        dispatch('download', event.detail);
    }

    function handleDelete(event: CustomEvent<FileRecord>) {
        dispatch('delete', event.detail);
    }

    function handleRename(event: CustomEvent<FileRecord>) {
        dispatch('rename', event.detail);
    }

    function handleFolderOpen(event: CustomEvent<FolderRecord>) {
        dispatch('folderOpen', event.detail);
    }

    function handleFolderDelete(event: CustomEvent<FolderRecord>) {
        dispatch('folderDelete', event.detail);
    }

    function handleFolderRename(event: CustomEvent<FolderRecord>) {
        dispatch('folderRename', event.detail);
    }

    const hasItems = $derived((files?.length || 0) + (folders?.length || 0) > 0);
</script>

<div bind:this={containerRef} class="select-none {viewMode === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3' : 'space-y-1'}">
    {#if isCreatingFolder}
        <div class="file-item-anim rounded-lg border-2 border-primary bg-primary/5 {viewMode === 'list' ? 'p-2' : 'p-4'}">
            <div class="flex items-center gap-3">
                <FolderOpen class="{viewMode === 'list' ? 'h-4 w-4' : 'h-12 w-12'} text-primary flex-shrink-0" />
                <div class="flex-1">
                    <input
                        bind:this={newFolderInputRef}
                        bind:value={newFolderName}
                        placeholder="Folder name..."
                        onkeydown={handleKeyDown}
                        onblur={() => {
                            setTimeout(() => {
                                if (newFolderName.trim()) {
                                    handleCreateFolder();
                                } else {
                                    handleCancelCreateFolder();
                                }
                            }, 200);
                        }}
                        class="w-full bg-transparent border-none outline-none text-sm font-medium placeholder:text-muted-foreground"
                        type="text"
                    />
                </div>
            </div>
        </div>
    {/if}

    {#if !hasItems && !isCreatingFolder}
        <div class="file-item-anim py-12 text-center">
            <p class="text-muted-foreground">No files or folders found</p>
        </div>
    {/if}
    {#if folders && folders.length > 0}
        {#each folders as folder (folder.id)}
            <div class="file-item-anim">
                <FolderCard
                    folderRecord={folder}
                    selected={selectedFolders.has(folder.id)}
                    showCheckbox={showCheckboxes}
                    {viewMode}
                    on:select={handleFolderSelect}
                    on:open={handleFolderOpen}
                    on:delete={handleFolderDelete}
                    on:rename={handleFolderRename}
                />
            </div>
        {/each}
    {/if}
    {#if files && files.length > 0}
        {#each files as file (file.id)}
            <div class="file-item-anim">
                <FileCard
                    {file}
                    selected={selectedFiles.has(file.id)}
                    showCheckbox={showCheckboxes}
                    {viewMode}
                    on:select={handleFileSelect}
                    on:preview={handlePreview}
                    on:download={handleDownload}
                    on:delete={handleDelete}
                    on:rename={handleRename}
                />
            </div>
        {/each}
    {/if}
</div>

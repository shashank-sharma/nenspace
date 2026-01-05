<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Download, Edit, Trash2, X, Folder, FolderOpen } from 'lucide-svelte';
    import { formatFileSize } from '$lib/utils/file-validation.util';
    import { DateUtil } from '$lib/utils/date.util';
    import { getFileIcon, getFileIconColor } from '../utils/file-icons.util';
    import type { FileRecord, FolderRecord } from '../types';
    import { createEventDispatcher } from 'svelte';
    import { pb } from '$lib/config/pocketbase';
    import { FileManagerService, FolderService } from '../services';
    import { fileManagerStore } from '../stores/file-manager.store.svelte';

    let {
        file,
        folder,
        open = $bindable(false)
    } = $props<{
        file?: FileRecord | null;
        folder?: FolderRecord | null;
        open?: boolean;
    }>();

    const dispatch = createEventDispatcher<{
        download: FileRecord;
        downloadFolder: FolderRecord;
        rename: FileRecord | FolderRecord;
        delete: FileRecord | FolderRecord;
        close: void;
    }>();

    const filePath = $derived(file ? fileManagerStore.getFileFullPath(file.id) : '');
    const folderPath = $derived(folder ? fileManagerStore.getFolderFullPath(folder.id) : '');

    const FileIcon = $derived(file ? getFileIcon(file.mime_type) : null);
    const iconColor = $derived(file ? getFileIconColor(file.mime_type) : '');

    function handleDownload() {
        if (file) {
            dispatch('download', file);
        } else if (folder) {
            FileManagerService.downloadSelectionAsZip([], [folder.id]);
        }
    }

    function handleRename() {
        if (file) {
            dispatch('rename', file);
        } else if (folder) {
            dispatch('rename', folder);
        }
    }

    function handleDelete() {
        if (file) {
            dispatch('delete', file);
        } else if (folder) {
            dispatch('delete', folder);
        }
    }

    function handleClose() {
        open = false;
        dispatch('close');
    }

    const fileUrl = $derived(file ? pb.files.getUrl(file, file.file) : null);
    const isImage = $derived(file?.mime_type.startsWith('image/') ?? false);
    const hasItem = $derived(file || folder);
</script>

{#if open && hasItem}
    <div class="h-full flex flex-col border-l bg-card">
        <div class="p-4 border-b flex items-center justify-between">
            <h3 class="font-semibold">{file ? 'File Details' : 'Folder Details'}</h3>
            <Button variant="ghost" size="icon" onclick={handleClose}>
                <X class="h-4 w-4" />
            </Button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-6">
            {#if file}
                {#if isImage && fileUrl}
                    <div class="flex justify-center">
                        <img
                            src={fileUrl}
                            alt={file.filename}
                            class="max-w-full max-h-48 rounded-lg object-contain border"
                        />
                    </div>
                {:else if FileIcon}
                    <div class="flex justify-center">
                        <div class="p-8 rounded-lg bg-muted flex items-center justify-center">
                            <svelte:component this={FileIcon} class="h-16 w-16 {iconColor}" />
                        </div>
                    </div>
                {/if}
            {:else if folder}
                <div class="flex justify-center">
                    <div class="p-8 rounded-lg bg-muted flex items-center justify-center">
                        <FolderOpen class="h-16 w-16 text-primary" />
                    </div>
                </div>
            {/if}

            <div class="space-y-4">
                <div>
                    <label class="text-sm font-medium text-muted-foreground">Name</label>
                    <p class="mt-1 text-sm font-medium">{file ? (file.original_filename || file.filename) : folder?.name}</p>
                </div>

                {#if (file && filePath) || (folder && folderPath)}
                    <div>
                        <label class="text-sm font-medium text-muted-foreground">Path</label>
                        <p class="mt-1 text-sm break-all">{file ? filePath : folderPath}</p>
                    </div>
                {/if}

                {#if file}
                    <div>
                        <label class="text-sm font-medium text-muted-foreground">Size</label>
                        <p class="mt-1 text-sm">{formatFileSize(file.size)}</p>
                    </div>

                    <div>
                        <label class="text-sm font-medium text-muted-foreground">Type</label>
                        <p class="mt-1 text-sm">{file.mime_type || 'Unknown'}</p>
                    </div>
                {/if}

                <div>
                    <label class="text-sm font-medium text-muted-foreground">Created</label>
                    <p class="mt-1 text-sm">{DateUtil.formatRelative((file || folder)!.created, { includeTime: true })}</p>
                </div>

                <div>
                    <label class="text-sm font-medium text-muted-foreground">Modified</label>
                    <p class="mt-1 text-sm">{DateUtil.formatRelative((file || folder)!.updated, { includeTime: true })}</p>
                </div>

                {#if file?.description}
                    <div>
                        <label class="text-sm font-medium text-muted-foreground">Description</label>
                        <p class="mt-1 text-sm">{file.description}</p>
                    </div>
                {/if}

                {#if file?.tags && file.tags.length > 0}
                    <div>
                        <label class="text-sm font-medium text-muted-foreground">Tags</label>
                        <div class="mt-1 flex flex-wrap gap-1">
                            {#each file.tags as tag}
                                <span class="rounded bg-muted px-2 py-0.5 text-xs">{tag}</span>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        <div class="p-4 border-t space-y-2">
            {#if file || folder}
                <Button class="w-full" onclick={handleDownload}>
                    <Download class="mr-2 h-4 w-4" />
                    {file ? 'Download' : 'Download as Zip'}
                </Button>
            {/if}
            <div class="flex gap-2">
                <Button variant="outline" class="flex-1" onclick={handleRename}>
                    <Edit class="mr-2 h-4 w-4" />
                    Rename
                </Button>
                <Button variant="outline" class="flex-1" onclick={handleDelete}>
                    <Trash2 class="mr-2 h-4 w-4 text-destructive" />
                    Delete
                </Button>
            </div>
        </div>
    </div>
{:else if open}
    <div class="h-full flex items-center justify-center border-l bg-card p-8">
        <p class="text-sm text-muted-foreground text-center">
            Select a file or folder to view its details
        </p>
    </div>
{/if}


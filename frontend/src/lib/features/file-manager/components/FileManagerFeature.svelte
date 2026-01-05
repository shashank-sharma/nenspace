<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { Button } from '$lib/components/ui/button';
    import { Grid3x3, List, Upload } from 'lucide-svelte';
    import SearchInput from '$lib/components/SearchInput.svelte';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
    import EmptyState from '$lib/components/EmptyState.svelte';
    import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
    import { useModalState } from '$lib/hooks';
    import { withErrorHandling } from '$lib/utils/error-handler.util';
    import { FileManagerService, FolderService } from '../services';
    import { fileManagerStore } from '../stores/file-manager.store.svelte';
    import type { FileRecord, FolderRecord, SortOption, SortOrder } from '../types';
    import FileList from './FileList.svelte';
    import FileUpload from './FileUpload.svelte';
    import FilePreview from './FilePreview.svelte';
    import QuotaIndicator from './QuotaIndicator.svelte';
    import Breadcrumbs from './Breadcrumbs.svelte';
    import FileTree from './FileTree.svelte';
    import FileMetadataPanel from './FileMetadataPanel.svelte';
    import QuickActionsToolbar from './QuickActionsToolbar.svelte';
    import SortControls from './SortControls.svelte';
    import DownloadProgress from './DownloadProgress.svelte';
    import UploadProgress from './UploadProgress.svelte';
    import { pb } from '$lib/config/pocketbase';
    import { toast } from 'svelte-sonner';
    import { registerKeyboardShortcuts, createFileManagerShortcuts } from '../utils/keyboard-shortcuts.util';

    const userId = $derived(pb.authStore.model?.id || '');
    const modals = useModalState<FileRecord>();

    let searchQuery = $state('');
    let viewMode = $state<'grid' | 'list'>('grid');
    let previewData = $state<{ type: 'image' | 'pdf' | 'text' | 'unsupported'; url: string; filename: string; mimeType: string } | null>(null);
    let previewOpen = $state(false);
    let selectedFile = $state<FileRecord | null>(null);
    let selectedFolder = $state<FolderRecord | null>(null);
    let metadataPanelOpen = $state(false);
    let sortBy = $state<SortOption>('name');
    let sortOrder = $state<SortOrder>('asc');
    let showCheckboxes = $state(false);
    let isCreatingFolderInView = $state(false);
    let selectedFolders = $state<Set<string>>(new Set());

    const filteredFiles = $derived.by(() => {
        let result = [...fileManagerStore.files];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(f =>
                f.filename.toLowerCase().includes(query) ||
                f.original_filename?.toLowerCase().includes(query) ||
                f.description?.toLowerCase().includes(query) ||
                f.tags?.some(tag => tag.toLowerCase().includes(query))
            );
        }

        result.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'name':
                    comparison = (a.original_filename || a.filename).localeCompare(b.original_filename || b.filename);
                    break;
                case 'date':
                    comparison = new Date(b.updated).getTime() - new Date(a.updated).getTime();
                    break;
                case 'size':
                    comparison = b.size - a.size;
                    break;
                case 'type':
                    comparison = a.mime_type.localeCompare(b.mime_type);
                    break;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    });

    const filteredFolders = $derived.by(() => {
        let result = [...fileManagerStore.folders];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(f => f.name.toLowerCase().includes(query));
        }

        result.sort((a, b) => {
            const comparison = a.name.localeCompare(b.name);
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        return result;
    });

    const breadcrumbs = $derived(fileManagerStore.breadcrumbs);

    const activeSelectedFiles = $derived.by(() => {
        const set = new Set<string>();
        if (selectedFile && metadataPanelOpen) {
            set.add(selectedFile.id);
        }
        if (showCheckboxes) {
            fileManagerStore.selectedFiles.forEach(id => set.add(id));
        }
        return set;
    });

    const activeSelectedFolders = $derived.by(() => {
        const set = new Set<string>();
        if (selectedFolder && metadataPanelOpen) {
            set.add(selectedFolder.id);
        }
        if (showCheckboxes) {
            fileManagerStore.selectedFolders.forEach(id => set.add(id));
        }
        return set;
    });

    let isInitialized = $state(false);

    $effect(() => {
        if (userId && !isInitialized) {
            isInitialized = true;
            fileManagerStore.initialize(userId).catch((error) => {
                console.error('Failed to initialize file manager:', error);
                isInitialized = false;
            });
        } else if (!userId && isInitialized) {
            isInitialized = false;
            fileManagerStore.reset();
        }
    });

    $effect(() => {
        const _ = fileManagerStore.selectedFolderId;
        isCreatingFolderInView = false;
    });

    $effect(() => {
        const shortcuts = registerKeyboardShortcuts(
            createFileManagerShortcuts({
                selectAll: () => {
                    if (!showCheckboxes) {
                        showCheckboxes = true;
                    }
                    fileManagerStore.selectAllFiles();
                },
                delete: () => {
                    if (fileManagerStore.selectedFiles.size > 0) {
                        handleBulkDelete();
                    }
                },
                download: () => {
                    if (fileManagerStore.selectedFiles.size > 0) {
                        handleBulkDownload();
                    }
                },
                search: () => {
                    document.querySelector<HTMLInputElement>('input[placeholder="Search files..."]')?.focus();
                },
                upload: () => {
                    modals.openCreate();
                }
            })
        );

        return () => {
            shortcuts();
            fileManagerStore.reset();
        };
    });

    async function handleUpload(event: CustomEvent<{ files: File[]; path?: string; folderId?: string; description?: string; tags?: string[] }>) {
        await withErrorHandling(
            () => FileManagerService.uploadFilesBulk(
                event.detail.files,
                event.detail.folderId || fileManagerStore.selectedFolderId,
                event.detail.description,
                event.detail.tags
            ),
            {
                successMessage: `${event.detail.files.length} ${event.detail.files.length === 1 ? 'file' : 'files'} uploaded successfully`,
                errorMessage: 'Failed to upload files',
                onSuccess: () => {
                    modals.closeAll();
                    fileManagerStore.refresh();
                }
            }
        );
    }

    async function handleDelete(event: CustomEvent<FileRecord>) {
        await withErrorHandling(
            () => FileManagerService.deleteFile(event.detail.id),
            {
                successMessage: 'File deleted successfully',
                errorMessage: 'Failed to delete file',
                onSuccess: () => {
                    modals.closeAll();
                    if (selectedFile?.id === event.detail.id) {
                        selectedFile = null;
                        metadataPanelOpen = false;
                    }
                }
            }
        );
    }

    async function handlePreview(event: CustomEvent<FileRecord>) {
        await withErrorHandling(
            () => FileManagerService.previewFile(event.detail.id),
            {
                errorMessage: 'Failed to load file preview',
                onSuccess: (result) => {
                    previewData = result;
                    previewOpen = true;
                }
            }
        );
    }

    async function handleDownload(event: CustomEvent<FileRecord>) {
        await withErrorHandling(
            () => FileManagerService.downloadFile(event.detail.id),
            {
                successMessage: 'File download started',
                errorMessage: 'Failed to download file',
                onSuccess: async (blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = event.detail.original_filename || event.detail.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            }
        );
    }

    async function handleRename(event: CustomEvent<FileRecord>) {
        const newName = prompt('Enter new filename:', event.detail.filename);
        if (!newName || newName === event.detail.filename) return;

        await withErrorHandling(
            () => FileManagerService.renameFile(event.detail.id, newName),
            {
                successMessage: 'File renamed successfully',
                errorMessage: 'Failed to rename file',
                onSuccess: () => {
                    if (selectedFile?.id === event.detail.id) {
                        selectedFile = { ...selectedFile, filename: newName };
                    }
                }
            }
        );
    }

    async function handlePreviewDownload() {
        if (!previewData) return;
        const file = fileManagerStore.files.find(f => f.filename === previewData.filename);
        if (file) {
            await handleDownload(new CustomEvent('download', { detail: file }));
        }
    }

    async function handleFolderOpen(event: CustomEvent<FolderRecord>) {
        await fileManagerStore.navigateToFolder(event.detail.id);
    }

    async function handleFolderDelete(event: CustomEvent<FolderRecord>) {
        await withErrorHandling(
            () => FolderService.deleteFolder(event.detail.id),
            {
                successMessage: 'Folder deleted successfully',
                errorMessage: 'Failed to delete folder',
                onSuccess: () => {
                    fileManagerStore.refresh();
                }
            }
        );
    }

    async function handleFolderRename(event: CustomEvent<FolderRecord>) {
        const newName = prompt('Enter new folder name:', event.detail.name);
        if (!newName || newName === event.detail.name) return;

        await withErrorHandling(
            () => FolderService.renameFolder(event.detail.id, newName),
            {
                successMessage: 'Folder renamed successfully',
                errorMessage: 'Failed to rename folder',
                onSuccess: () => {
                    fileManagerStore.refresh();
                }
            }
        );
    }

    async function handleCreateFolder(event: CustomEvent<{ name: string; parentId?: string }> | string, parentId?: string) {
        let folderName: string;
        let targetParentId: string | undefined;

        if (typeof event === 'string') {
            folderName = event.trim();
            targetParentId = parentId !== undefined ? parentId : fileManagerStore.selectedFolderId;
        } else {
            const detail = event.detail;
            folderName = detail.name?.trim() || '';
            targetParentId = detail.parentId !== undefined ? detail.parentId : (parentId !== undefined ? parentId : fileManagerStore.selectedFolderId);
        }

        if (!folderName) {
            isCreatingFolderInView = false;
            return;
        }

        await withErrorHandling(
            async () => {
                const createdFolder = await FolderService.createFolder(folderName, targetParentId);
                await fileManagerStore.refresh();
                if (createdFolder && createdFolder.id && !targetParentId) {
                    await fileManagerStore.navigateToFolder(createdFolder.id);
                }
                isCreatingFolderInView = false;
                return createdFolder;
            },
            {
                successMessage: `Folder "${folderName}" created successfully`,
                errorMessage: 'Failed to create folder',
                onSuccess: () => {
                },
                onError: () => {
                    isCreatingFolderInView = false;
                }
            }
        );
    }

    function handleNewFolderClick() {
        isCreatingFolderInView = true;
    }

    function handleCreateFolderInView(name: string) {
        if (name && name.trim()) {
            handleCreateFolder(name);
        } else {
            isCreatingFolderInView = false;
        }
    }

    function handleFileSelect(event: CustomEvent<FileRecord | FolderRecord>) {
        if ('mime_type' in event.detail) {
            selectedFile = event.detail as FileRecord;
            selectedFolder = null;
            metadataPanelOpen = true;
            fileManagerStore.toggleFileSelection(event.detail.id);
        } else {
            selectedFolder = event.detail as FolderRecord;
            selectedFile = null;
            metadataPanelOpen = true;
            fileManagerStore.toggleFolderSelection(event.detail.id);
        }
    }

    function handleBulkDelete() {
        const files = fileManagerStore.getSelectedFiles();
        if (files.length === 0) return;

        if (confirm(`Delete ${files.length} file(s)?`)) {
            Promise.all(files.map(f => FileManagerService.deleteFile(f.id)))
                .then(() => {
                    toast.success('Files deleted successfully');
                    fileManagerStore.clearSelection();
                    fileManagerStore.refresh();
                })
                .catch(() => {
                    toast.error('Failed to delete some files');
                });
        }
    }

    function handleBulkDownload() {
        const fileIds = Array.from(fileManagerStore.selectedFiles);
        const folderIds = Array.from(fileManagerStore.selectedFolders);

        if (fileIds.length === 0 && folderIds.length === 0) return;

        if (fileIds.length === 1 && folderIds.length === 0) {
            const file = fileManagerStore.files.find(f => f.id === fileIds[0]);
            if (file) {
                handleDownload(new CustomEvent('download', { detail: file }));
                return;
            }
        }

        try {
            FileManagerService.downloadSelectionAsZip(fileIds, folderIds);
        } catch (error) {
            toast.error('Failed to start download');
        }
    }

    const selectedCount = $derived(fileManagerStore.selectedFiles.size + selectedFolders.size);
</script>

<div class="h-screen flex flex-col overflow-hidden">
    <div class="flex-shrink-0 p-4 border-b bg-card">
        <div class="flex items-center justify-between mb-4">
            <h1 class="text-2xl font-bold">File Manager</h1>
            <div class="flex items-center gap-2">
                <Button
                    variant={viewMode === 'grid' ? 'default' : 'outline'}
                    size="icon"
                    onclick={() => viewMode = 'grid'}
                    title="Grid view"
                >
                    <Grid3x3 class="h-4 w-4" />
                </Button>
                <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="icon"
                    onclick={() => viewMode = 'list'}
                    title="List view"
                >
                    <List class="h-4 w-4" />
                </Button>
            </div>
        </div>

        <div class="flex items-center gap-4">
            <div class="flex-1">
                <SearchInput
                    bind:value={searchQuery}
                    placeholder="Search files..."
                />
            </div>
            <SortControls bind:sortBy bind:sortOrder />
        </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
        <aside class="w-64 flex-shrink-0 border-r bg-muted/30 overflow-hidden flex flex-col">
            {#if fileManagerStore.quotaInfo}
                <div class="p-2 border-b">
                    <QuotaIndicator quotaInfo={fileManagerStore.quotaInfo} />
                </div>
            {/if}
            <div class="flex-1 overflow-hidden">
                <FileTree
                    on:createFolder={handleCreateFolder}
                    on:createNestedFolder={handleCreateFolder}
                />
            </div>
        </aside>

        <main class="flex-1 flex flex-col overflow-hidden" class:w-full={!metadataPanelOpen}>
            <div class="flex-shrink-0">
                <QuickActionsToolbar
                    selectedCount={selectedCount}
                    on:upload={() => modals.openCreate()}
                    on:newFolder={handleNewFolderClick}
                    on:deleteSelected={handleBulkDelete}
                    on:downloadSelected={handleBulkDownload}
                />

                <div class="px-4 pt-4 border-b bg-card/50 pb-2">
                    <Breadcrumbs
                        {breadcrumbs}
                        currentFolderId={fileManagerStore.selectedFolderId}
                        on:navigate={async (e) => {
                            await fileManagerStore.navigateToFolder(e.detail);
                        }}
                    />
                </div>
            </div>

            <div class="flex-1 relative overflow-hidden flex flex-col">
                {#if fileManagerStore.loading && !isInitialized}
                    <div class="flex-1 flex items-center justify-center">
                        <LoadingSpinner centered size="lg" label="Initializing..." />
                    </div>
                {:else}
                    <div class="flex-1 overflow-y-auto p-4 transition-opacity duration-300 {fileManagerStore.loading ? 'opacity-50' : 'opacity-100'}">
                        {#if filteredFiles.length === 0 && filteredFolders.length === 0 && !isCreatingFolderInView}
                            <div class="flex-1 h-full flex items-center justify-center">
                                <EmptyState
                                    icon={Upload}
                                    title="No files yet"
                                    description="Start by uploading your first file or creating a folder"
                                    actionLabel="Upload File"
                                    onaction={() => modals.openCreate()}
                                />
                            </div>
                        {:else}
                            <FileList
                                files={filteredFiles}
                                folders={filteredFolders}
                                {viewMode}
                                selectedFiles={activeSelectedFiles}
                                selectedFolders={activeSelectedFolders}
                                {showCheckboxes}
                                isCreatingFolder={isCreatingFolderInView}
                                onCreateFolder={handleCreateFolderInView}
                                on:select={handleFileSelect}
                                on:preview={handlePreview}
                                on:download={handleDownload}
                                on:delete={(e) => modals.openDelete(e.detail)}
                                on:rename={handleRename}
                                on:folderOpen={handleFolderOpen}
                                on:folderDelete={handleFolderDelete}
                                on:folderRename={handleFolderRename}
                            />
                        {/if}
                    </div>

                    {#if fileManagerStore.loading}
                        <div class="absolute inset-0 bg-background/20 backdrop-blur-[1px] flex items-center justify-center z-10">
                            <LoadingSpinner size="lg" label="Updating..." />
                        </div>
                    {/if}
                {/if}
            </div>
        </main>

        {#if metadataPanelOpen}
            <aside class="w-80 flex-shrink-0 border-l bg-card overflow-hidden">
                <FileMetadataPanel
                    file={selectedFile}
                    folder={selectedFolder}
                    bind:open={metadataPanelOpen}
                    on:download={(e) => handleDownload(new CustomEvent('download', { detail: e.detail }))}
                    on:rename={(e) => {
                        if ('mime_type' in e.detail) {
                            handleRename(new CustomEvent('rename', { detail: e.detail as FileRecord }));
                        } else {
                            handleFolderRename(new CustomEvent('rename', { detail: e.detail as FolderRecord }));
                        }
                    }}
                    on:delete={(e) => {
                        if ('mime_type' in e.detail) {
                            modals.openDelete(e.detail as FileRecord);
                        } else {
                            handleFolderDelete(new CustomEvent('delete', { detail: e.detail as FolderRecord }));
                        }
                    }}
                    on:close={() => {
                        selectedFile = null;
                        selectedFolder = null;
                    }}
                />
            </aside>
        {/if}
    </div>
</div>

    <FileUpload
        bind:open={modals.createModalOpen}
        {userId}
        currentFolderId={fileManagerStore.selectedFolderId}
        on:submit={handleUpload}
        on:cancel={() => modals.closeAll()}
    />

    <div class="fixed bottom-4 right-4 z-[100] w-80 flex flex-col-reverse gap-3 pointer-events-none">
        <DownloadProgress />
        <UploadProgress />
    </div>

    <FilePreview
        bind:open={previewOpen}
    {previewData}
    on:download={handlePreviewDownload}
/>

<ConfirmDialog
    bind:open={modals.deleteModalOpen}
    title="Delete this file?"
    description="This action cannot be undone."
    confirmText="Delete"
    variant="destructive"
    onconfirm={async () => {
        if (modals.itemToDelete) {
            await handleDelete(new CustomEvent('delete', { detail: modals.itemToDelete }));
        }
    }}
/>

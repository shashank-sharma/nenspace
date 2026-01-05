<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Upload, X, File as FileIcon, Trash2 } from 'lucide-svelte';
    import { formatFileSize } from '$lib/utils/file-validation.util';
    import { QuotaService } from '../services/quota.service';
    import { FolderService } from '../services/folder.service';
    import { DEFAULT_QUOTA_BYTES } from '../constants';
    import { createEventDispatcher } from 'svelte';
    import * as Select from '$lib/components/ui/select';

    let {
        open = $bindable(false),
        userId,
        currentFolderId
    } = $props<{
        open?: boolean;
        userId: string;
        currentFolderId?: string;
    }>();

    const dispatch = createEventDispatcher<{
        submit: { files: File[]; folderId?: string; description?: string; tags?: string[] };
        cancel: void;
    }>();

    let selectedFiles = $state<File[]>([]);
    let description = $state('');
    let tags = $state('');
    let isUploading = $state(false);
    let quotaInfo = $state<{ availableBytes: number } | null>(null);
    let isLoadingQuota = $state(false);
    let isLoadingFolders = $state(false);
    let selectedFolderId = $state<string | undefined>(undefined);
    let availableFolders = $state<Array<{ id: string; name: string; path: string }>>([]);

    let hasLoadedQuota = $state(false);
    let hasLoadedFolders = $state(false);

    const totalSelectedSize = $derived(selectedFiles.reduce((acc, f) => acc + f.size, 0));

    $effect(() => {
        if (open && userId) {
            if (!hasLoadedQuota && !isLoadingQuota && !quotaInfo) {
                hasLoadedQuota = true;
                loadQuotaInfo();
            }
            if (!hasLoadedFolders && !isLoadingFolders) {
                hasLoadedFolders = true;
                loadFolders();
            }
            if (currentFolderId !== undefined) {
                selectedFolderId = currentFolderId;
            } else {
                selectedFolderId = undefined;
            }
        } else if (!open) {
            hasLoadedQuota = false;
            hasLoadedFolders = false;
        }
    });

    async function loadFolders() {
        if (isLoadingFolders) return;
        isLoadingFolders = true;
        try {
            const allFolders = await FolderService.getAllFolders();
            const foldersWithPaths = await Promise.all(
                allFolders.map(async (f) => {
                    let path = '';
                    if (f.parent) {
                        try {
                            path = await FolderService.getFolderPath(f.id);
                        } catch {
                            path = f.name;
                        }
                    } else {
                        path = f.name;
                    }
                    return { id: f.id, name: f.name, path };
                })
            );
            availableFolders = foldersWithPaths;
        } catch (error) {
            console.error('Failed to load folders:', error);
        } finally {
            isLoadingFolders = false;
        }
    }

    async function loadQuotaInfo() {
        if (isLoadingQuota || !userId) return;

        isLoadingQuota = true;
        try {
            const info = await QuotaService.getQuotaInfo(userId);
            quotaInfo = { availableBytes: info.availableBytes };
        } catch (error) {
            console.error('Failed to load quota info:', error);
            quotaInfo = { availableBytes: DEFAULT_QUOTA_BYTES };
        } finally {
            isLoadingQuota = false;
        }
    }

    function addFiles(files: FileList | null) {
        if (!files) return;

        const newFiles = Array.from(files);
        const validFiles = newFiles.filter(file => {
            if (quotaInfo && (totalSelectedSize + file.size) > quotaInfo.availableBytes) {
                alert(`Adding "${file.name}" would exceed available quota.`);
                return false;
            }
            return true;
        });

        selectedFiles = [...selectedFiles, ...validFiles];
    }

    function handleFileSelect(event: Event) {
        const target = event.target as HTMLInputElement;
        addFiles(target.files);
        target.value = '';
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        addFiles(event.dataTransfer?.files || null);
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
    }

    function handleSubmit() {
        if (selectedFiles.length === 0) {
            return;
        }

        const tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);

        dispatch('submit', {
            files: selectedFiles,
            folderId: selectedFolderId,
            description: description.trim() || undefined,
            tags: tagsArray.length > 0 ? tagsArray : undefined
        });

        resetForm();
    }

    function handleCancel() {
        resetForm();
        dispatch('cancel');
    }

    function resetForm() {
        selectedFiles = [];
        description = '';
        tags = '';
        selectedFolderId = currentFolderId;
    }

    function removeFile(index: number) {
        selectedFiles = selectedFiles.filter((_, i) => i !== index);
    }
</script>

{#if open}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
        <div class="w-full max-w-2xl rounded-lg border bg-card p-6 shadow-lg flex flex-col max-h-[90vh]">
            <div class="mb-4 flex items-center justify-between">
                <h2 class="text-xl font-semibold">Upload Files</h2>
                <Button variant="ghost" size="icon" onclick={handleCancel}>
                    <X class="h-4 w-4" />
                </Button>
            </div>

            <div class="space-y-4 overflow-y-auto flex-1 pr-2">
                <div
                    class="border-2 border-dashed rounded-lg p-8 text-center transition-colors hover:border-primary cursor-pointer relative"
                    ondragover={handleDragOver}
                    ondrop={handleDrop}
                >
                    <Upload class="mx-auto h-12 w-12 text-muted-foreground" />
                    <p class="mt-2 text-sm text-muted-foreground">
                        Drag and drop files here, or click to select
                    </p>
                    <input
                        type="file"
                        multiple
                        class="absolute inset-0 opacity-0 cursor-pointer"
                        onchange={handleFileSelect}
                    />
                </div>

                {#if selectedFiles.length > 0}
                    <div class="space-y-2">
                        <Label>Selected Files ({selectedFiles.length})</Label>
                        <div class="border rounded-md divide-y max-h-40 overflow-y-auto">
                            {#each selectedFiles as file, i}
                                <div class="p-2 flex items-center justify-between text-sm">
                                    <div class="flex items-center gap-2 min-w-0">
                                        <FileIcon class="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span class="truncate">{file.name}</span>
                                        <span class="text-xs text-muted-foreground shrink-0">({formatFileSize(file.size)})</span>
                                    </div>
                                    <Button variant="ghost" size="icon" class="h-7 w-7" onclick={() => removeFile(i)}>
                                        <Trash2 class="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                </div>
                            {/each}
                        </div>
                        <p class="text-xs text-right text-muted-foreground">
                            Total size: {formatFileSize(totalSelectedSize)}
                        </p>
                    </div>
                {/if}

                <div>
                    <Label for="folder">Folder (optional)</Label>
                    <Select.Root
                        selected={selectedFolderId ? { value: selectedFolderId, label: availableFolders.find(f => f.id === selectedFolderId)?.path || 'Selected folder' } : undefined}
                        onSelectedChange={(value) => {
                            selectedFolderId = value?.value || undefined;
                        }}
                    >
                        <Select.Trigger class="w-full">
                            <Select.Value placeholder="Select a folder (optional)" />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="">Root Folder</Select.Item>
                            {#each availableFolders as folder (folder.id)}
                                <Select.Item value={folder.id}>
                                    {folder.path}
                                </Select.Item>
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </div>

                <div>
                    <Label for="description">Description (optional)</Label>
                    <Textarea
                        id="description"
                        bind:value={description}
                        placeholder="File description"
                        rows={2}
                    />
                </div>

                <div>
                    <Label for="tags">Tags (optional, comma-separated)</Label>
                    <Input
                        id="tags"
                        bind:value={tags}
                        placeholder="work, important"
                    />
                </div>

                {#if quotaInfo}
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-muted-foreground">Available Quota:</span>
                        <span class={totalSelectedSize > quotaInfo.availableBytes ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                            {formatFileSize(quotaInfo.availableBytes)}
                        </span>
                    </div>
                {/if}
            </div>

            <div class="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="outline" onclick={handleCancel}>
                    Cancel
                </Button>
                <Button onclick={handleSubmit} disabled={selectedFiles.length === 0 || isUploading || (quotaInfo && totalSelectedSize > quotaInfo.availableBytes)}>
                    {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} ${selectedFiles.length === 1 ? 'File' : 'Files'}`}
                </Button>
            </div>
        </div>
    </div>
{/if}

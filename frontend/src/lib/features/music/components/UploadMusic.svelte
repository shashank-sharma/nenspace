<script lang="ts">
    import { Upload, X, Music, Check, AlertCircle } from 'lucide-svelte';
    import { MusicService } from '../services';
    import { SUPPORTED_AUDIO_FORMATS, SUPPORTED_EXTENSIONS, MAX_UPLOAD_SIZE } from '../constants';
    import { withErrorHandling } from '$lib/utils';
    import { Button } from '$lib/components/ui/button';
    import * as Dialog from '$lib/components/ui/dialog';

    interface Props {
        open: boolean;
        oncomplete: () => void;
    }

    let { open = $bindable(), oncomplete }: Props = $props();

    interface UploadItem {
        id: string;
        file: File;
        status: 'pending' | 'uploading' | 'success' | 'error';
        progress: number;
        error?: string;
    }

    let uploadQueue = $state<UploadItem[]>([]);
    let isDragging = $state(false);
    let fileInput: HTMLInputElement;

    function generateId(): string {
        return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    function validateFile(file: File): string | null {
        if (!SUPPORTED_AUDIO_FORMATS.includes(file.type)) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (!ext || !SUPPORTED_EXTENSIONS.includes(`.${ext}`)) {
                return 'Unsupported file format';
            }
        }
        if (file.size > MAX_UPLOAD_SIZE) {
            return `File size exceeds ${MAX_UPLOAD_SIZE / 1024 / 1024}MB limit`;
        }
        return null;
    }

    function addFiles(files: FileList | null) {
        if (!files) return;

        for (const file of files) {
            const error = validateFile(file);
            uploadQueue.push({
                id: generateId(),
                file,
                status: error ? 'error' : 'pending',
                progress: 0,
                error: error || undefined
            });
        }

        uploadQueue = [...uploadQueue];
    }

    function removeItem(id: string) {
        uploadQueue = uploadQueue.filter(item => item.id !== id);
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        isDragging = true;
    }

    function handleDragLeave(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        addFiles(e.dataTransfer?.files || null);
    }

    function handleFileSelect(e: Event) {
        const target = e.target as HTMLInputElement;
        addFiles(target.files);
        target.value = '';
    }

    async function uploadAll() {
        const pending = uploadQueue.filter(item => item.status === 'pending');

        for (const item of pending) {
            item.status = 'uploading';
            uploadQueue = [...uploadQueue];

            await withErrorHandling(
                () => MusicService.uploadTrack(item.file),
                {
                    onSuccess: () => {
                        item.status = 'success';
                        item.progress = 100;
                        uploadQueue = [...uploadQueue];
                    },
                    onError: (error) => {
                        item.status = 'error';
                        item.error = error.message || 'Upload failed';
                        uploadQueue = [...uploadQueue];
                    }
                }
            );
        }

        const allComplete = uploadQueue.every(item => item.status === 'success' || item.status === 'error');
        const anySuccess = uploadQueue.some(item => item.status === 'success');

        if (allComplete && anySuccess) {
            setTimeout(() => {
                oncomplete();
                uploadQueue = [];
            }, 1000);
        }
    }

    function clearCompleted() {
        uploadQueue = uploadQueue.filter(item => item.status !== 'success');
    }

    let pendingCount = $derived(uploadQueue.filter(item => item.status === 'pending').length);
    let canUpload = $derived(pendingCount > 0);
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="sm:max-w-xl">
        <Dialog.Header>
            <Dialog.Title>Upload Music</Dialog.Title>
            <Dialog.Description>
                Upload audio files to your music library. Supported formats: MP3, FLAC, WAV, OGG, M4A, AAC
            </Dialog.Description>
        </Dialog.Header>

        <div class="space-y-4 py-4">
            <div
                class="border-2 border-dashed rounded-lg p-8 text-center transition-colors {isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}"
                ondragover={handleDragOver}
                ondragleave={handleDragLeave}
                ondrop={handleDrop}
                role="button"
                tabindex="0"
                onclick={() => fileInput?.click()}
                onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
            >
                <Upload class="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                <p class="text-sm text-muted-foreground mb-2">
                    Drag and drop audio files here, or click to browse
                </p>
                <p class="text-xs text-muted-foreground">
                    Maximum file size: {MAX_UPLOAD_SIZE / 1024 / 1024}MB
                </p>
                <input
                    bind:this={fileInput}
                    type="file"
                    accept={SUPPORTED_EXTENSIONS.join(',')}
                    multiple
                    class="hidden"
                    onchange={handleFileSelect}
                />
            </div>

            {#if uploadQueue.length > 0}
                <div class="space-y-2 max-h-64 overflow-auto">
                    {#each uploadQueue as item}
                        <div class="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <div class="h-8 w-8 rounded flex items-center justify-center flex-shrink-0">
                                {#if item.status === 'success'}
                                    <Check class="h-4 w-4 text-green-500" />
                                {:else if item.status === 'error'}
                                    <AlertCircle class="h-4 w-4 text-destructive" />
                                {:else}
                                    <Music class="h-4 w-4 text-muted-foreground" />
                                {/if}
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm truncate">{item.file.name}</p>
                                {#if item.error}
                                    <p class="text-xs text-destructive">{item.error}</p>
                                {:else if item.status === 'uploading'}
                                    <div class="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                                        <div class="h-full bg-primary transition-all" style="width: {item.progress}%"></div>
                                    </div>
                                {:else}
                                    <p class="text-xs text-muted-foreground">
                                        {(item.file.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                {/if}
                            </div>
                            {#if item.status !== 'uploading'}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    class="h-8 w-8"
                                    onclick={() => removeItem(item.id)}
                                >
                                    <X class="h-4 w-4" />
                                </Button>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>

        <Dialog.Footer>
            <Button variant="outline" onclick={clearCompleted} disabled={!uploadQueue.some(i => i.status === 'success')}>
                Clear Completed
            </Button>
            <Button onclick={uploadAll} disabled={!canUpload}>
                Upload {pendingCount > 0 ? `(${pendingCount})` : ''}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>





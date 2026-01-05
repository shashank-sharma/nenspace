<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Download } from 'lucide-svelte';
    import * as Dialog from '$lib/components/ui/dialog';
    import type { PreviewData } from '../types';
    import { createEventDispatcher } from 'svelte';

    let {
        open = $bindable(false),
        previewData
    } = $props<{
        open?: boolean;
        previewData: PreviewData | null;
    }>();

    const dispatch = createEventDispatcher<{
        download: void;
    }>();

    let textContent = $state<string>('');
    let isLoadingText = $state(false);

    $effect(() => {
        if (previewData?.type === 'text' && previewData.url) {
            loadTextContent(previewData.url);
        } else {
            textContent = '';
        }
    });

    async function loadTextContent(url: string) {
        isLoadingText = true;
        try {
            const response = await fetch(url);
            textContent = await response.text();
        } catch (error) {
            textContent = 'Failed to load text content';
        } finally {
            isLoadingText = false;
        }
    }

    function handleDownload() {
        dispatch('download');
    }

    function handleClose() {
        open = false;
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="max-w-4xl">
        <Dialog.Header>
            <Dialog.Title>{previewData?.filename || 'File Preview'}</Dialog.Title>
        </Dialog.Header>

        {#if previewData}
            <div class="space-y-4">
                {#if previewData.type === 'image'}
                    <div class="flex justify-center">
                        <img
                            src={previewData.url}
                            alt={previewData.filename}
                            class="max-h-[70vh] max-w-full rounded-lg object-contain"
                        />
                    </div>
                {:else if previewData.type === 'pdf'}
                    <div class="flex h-[70vh] w-full justify-center">
                        <iframe
                            src={previewData.url}
                            class="h-full w-full rounded-lg border"
                            title={previewData.filename}
                        />
                    </div>
                {:else if previewData.type === 'text'}
                    <div class="max-h-[70vh] overflow-auto rounded-lg border bg-muted p-4">
                        {#if isLoadingText}
                            <p class="text-muted-foreground">Loading...</p>
                        {:else}
                            <pre class="whitespace-pre-wrap text-sm">{textContent}</pre>
                        {/if}
                    </div>
                {:else}
                    <div class="py-12 text-center">
                        <p class="text-muted-foreground">Preview not available for this file type</p>
                    </div>
                {/if}

                <div class="flex justify-end gap-2">
                    <Button variant="outline" onclick={handleDownload}>
                        <Download class="mr-2 h-4 w-4" />
                        Download
                    </Button>
                </div>
            </div>
        {/if}
    </Dialog.Content>
</Dialog.Root>


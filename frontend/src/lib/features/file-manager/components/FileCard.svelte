<script lang="ts">
    import { Checkbox } from '$lib/components/ui/checkbox';
    import { formatFileSize } from '$lib/utils/file-validation.util';
    import { getFileIcon, getFileIconColor } from '../utils/file-icons.util';
    import type { FileRecord } from '../types';
    import { createEventDispatcher } from 'svelte';
    import { pb } from '$lib/config/pocketbase';

    let {
        file,
        selected = false,
        showCheckbox = false,
        viewMode = 'grid'
    } = $props<{
        file: FileRecord;
        selected?: boolean;
        showCheckbox?: boolean;
        viewMode?: 'grid' | 'list';
    }>();

    const dispatch = createEventDispatcher<{
        select: FileRecord;
        preview: FileRecord;
        download: FileRecord;
        delete: FileRecord;
        rename: FileRecord;
    }>();

    const formattedSize = $derived(formatFileSize(file.size));
    const FileIcon = $derived(getFileIcon(file.mime_type));
    const iconColor = $derived(getFileIconColor(file.mime_type));
    const fileUrl = $derived(pb.files.getUrl(file, file.file));
    const isImage = $derived(file.mime_type.startsWith('image/'));

    let clickTimeout: ReturnType<typeof setTimeout> | null = null;

    function handleClick() {
        if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
            dispatch('preview', file);
        } else {
            clickTimeout = setTimeout(() => {
                dispatch('select', file);
                clickTimeout = null;
            }, 200);
        }
    }

    function handleCheckboxClick(e: MouseEvent) {
        e.stopPropagation();
        dispatch('select', file);
    }
</script>

<div
    class="group relative rounded-lg border-2 transition-all cursor-pointer select-none
    {viewMode === 'list' ? 'p-2' : 'p-4'}
    {selected ? 'bg-accent border-primary shadow-md ring-2 ring-primary/20' : 'bg-card border-border hover:border-primary/50 hover:shadow-md'}"
    onclick={handleClick}
    role="button"
    tabindex="0"
>
    <div class="flex items-center gap-3">
        {#if showCheckbox}
            <Checkbox
                bind:checked={selected}
                onclick={handleCheckboxClick}
                class={viewMode === 'list' ? '' : 'mt-1'}
            />
        {/if}

        <div class="flex shrink-0 items-center justify-center rounded bg-muted
            {viewMode === 'list' ? 'h-8 w-8' : 'h-12 w-12 rounded-lg'}">
            {#if isImage && fileUrl}
                <img
                    src={fileUrl}
                    alt={file.filename}
                    class="h-full w-full object-cover {viewMode === 'list' ? 'rounded' : 'rounded-lg'}"
                />
            {:else if FileIcon}
                <svelte:component this={FileIcon} class="{viewMode === 'list' ? 'h-4 w-4' : 'h-6 w-6'} {iconColor}" />
            {/if}
        </div>

        <div class="min-w-0 flex-1 flex {viewMode === 'list' ? 'items-center justify-between gap-4' : 'flex-col'}">
            <h3 class="truncate font-medium text-foreground text-sm" title={file.original_filename || file.filename}>
                {file.original_filename || file.filename}
            </h3>
            <p class="text-xs text-muted-foreground shrink-0 {viewMode === 'list' ? '' : 'mt-1'}">
                {formattedSize}
            </p>
        </div>
    </div>
</div>

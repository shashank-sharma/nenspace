<script lang="ts">
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import { Download, Edit, Trash2, FolderOpen, Copy, Move } from 'lucide-svelte';
    import type { FileRecord, FolderRecord } from '../types';
    import { createEventDispatcher } from 'svelte';

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
        open: FileRecord | FolderRecord;
        download: FileRecord;
        rename: FileRecord | FolderRecord;
        delete: FileRecord | FolderRecord;
        move: FileRecord | FolderRecord;
        copy: FileRecord | FolderRecord;
    }>();

    const item = $derived(file || folder);
    const isFolder = $derived(!!folder);
</script>

{#if item}
    <DropdownMenu.Root bind:open>
        <DropdownMenu.Trigger asChild let:builder>
            <div {...builder} class="absolute inset-0" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
            {#if isFolder}
                <DropdownMenu.Item onclick={() => dispatch('open', item as FolderRecord)}>
                    <FolderOpen class="mr-2 h-4 w-4" />
                    Open
                </DropdownMenu.Item>
            {:else}
                <DropdownMenu.Item onclick={() => dispatch('download', item as FileRecord)}>
                    <Download class="mr-2 h-4 w-4" />
                    Download
                </DropdownMenu.Item>
            {/if}
            <DropdownMenu.Item onclick={() => dispatch('rename', item)}>
                <Edit class="mr-2 h-4 w-4" />
                Rename
            </DropdownMenu.Item>
            <DropdownMenu.Item onclick={() => dispatch('move', item)}>
                <Move class="mr-2 h-4 w-4" />
                Move
            </DropdownMenu.Item>
            {#if !isFolder}
                <DropdownMenu.Item onclick={() => dispatch('copy', item as FileRecord)}>
                    <Copy class="mr-2 h-4 w-4" />
                    Copy
                </DropdownMenu.Item>
            {/if}
            <DropdownMenu.Separator />
            <DropdownMenu.Item
                variant="destructive"
                onclick={() => dispatch('delete', item)}
            >
                <Trash2 class="mr-2 h-4 w-4" />
                Delete
            </DropdownMenu.Item>
        </DropdownMenu.Content>
    </DropdownMenu.Root>
{/if}


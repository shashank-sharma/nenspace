<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { FolderRecord } from '../types';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import { Folder, FolderOpen } from 'lucide-svelte';
    import { DateUtil } from '$lib/utils/date.util';
    import { fileManagerStore } from '../stores/file-manager.store.svelte';

    let {
        folderRecord,
        selected = false,
        showCheckbox = false,
        viewMode = 'grid'
    } = $props<{
        folderRecord: FolderRecord;
        selected?: boolean;
        showCheckbox?: boolean;
        viewMode?: 'grid' | 'list';
    }>();

    const dispatch = createEventDispatcher<{
        select: FolderRecord;
        open: FolderRecord;
        delete: FolderRecord;
        rename: FolderRecord;
    }>();

    const folderPath = $derived(fileManagerStore.getFolderFullPath(folderRecord.id));

    let clickTimeout: ReturnType<typeof setTimeout> | null = null;

    function handleClick() {
        if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
            dispatch('open', folderRecord);
        } else {
            clickTimeout = setTimeout(() => {
                dispatch('select', folderRecord);
                clickTimeout = null;
            }, 200);
        }
    }

    function handleCheckboxClick(e: MouseEvent) {
        e.stopPropagation();
        dispatch('select', folderRecord);
    }
</script>

{#if viewMode === 'list'}
    <div
        class="group relative rounded-lg border-2 p-2 transition-all cursor-pointer select-none
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
                />
            {/if}
            <FolderOpen class="h-4 w-4 text-primary shrink-0" />
            <div class="min-w-0 flex-1 flex items-center justify-between gap-4">
                <h3 class="truncate font-semibold text-sm text-foreground" title={folderRecord.name}>
                    {folderRecord.name}
                </h3>
                {#if folderPath}
                    <p class="text-[10px] text-muted-foreground truncate hidden md:block max-w-[200px]" title={folderPath}>
                        {folderPath}
                    </p>
                {/if}
            </div>
        </div>
    </div>
{:else}
    <Card
        class="flex flex-col h-full cursor-pointer transition-all border-2 select-none
        {selected ? 'bg-accent border-primary shadow-md ring-2 ring-primary/20' : 'bg-card border-border hover:border-primary/50 hover:shadow-md'}"
        onclick={handleClick}
        role="button"
        tabindex="0"
    >
        <CardHeader class="flex-row items-center space-x-2 pb-2">
            {#if showCheckbox}
                <Checkbox
                    bind:checked={selected}
                    onclick={handleCheckboxClick}
                />
            {/if}
            <FolderOpen class="h-6 w-6 text-primary flex-shrink-0" />
            <CardTitle class="text-base font-semibold truncate flex-1" title={folderRecord.name}>
                {folderRecord.name}
            </CardTitle>
        </CardHeader>
        <CardContent class="flex-1 text-sm text-muted-foreground space-y-1">
            {#if folderPath}
                <p class="text-xs truncate" title={folderPath}>
                    {folderPath}
                </p>
            {/if}
            <p class="text-xs">Created: {DateUtil.formatRelative(folderRecord.created)}</p>
        </CardContent>
    </Card>
{/if}

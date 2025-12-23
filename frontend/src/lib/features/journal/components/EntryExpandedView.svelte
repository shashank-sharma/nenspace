<script lang="ts">
    import type { LocalStreamEntry } from '../types';
    import { Card, CardContent, CardHeader } from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import { X } from 'lucide-svelte';
    import EntryNode from './EntryNode.svelte';
    import { JournalStorageService } from '../services/journal-storage.service';
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { toast } from 'svelte-sonner';

    interface Props {
        entry: LocalStreamEntry;
        onClose: () => void;
        onEntryUpdate?: (newEntry?: LocalStreamEntry) => void;
    }

    let { entry: initialEntry, onClose, onEntryUpdate }: Props = $props();
    
    let currentEntry = $state(initialEntry);

    // Reload entry from storage to get latest updates
    async function reloadEntry() {
        try {
            const updated = await JournalStorageService.getEntry(currentEntry.id);
            if (updated) {
                currentEntry = updated;
            } else {
                // Entry was deleted
                toast.info('Entry was deleted');
                onClose();
            }
        } catch (error) {
            console.error('[EntryExpandedView] Failed to reload entry:', error);
        }
    }

    // Handle entry updates
    function handleEntryUpdate(newEntry?: LocalStreamEntry) {
        if (newEntry) {
            currentEntry = newEntry;
        } else {
            // Reload from storage
            reloadEntry();
        }
        // Propagate to parent
        onEntryUpdate?.(newEntry);
    }

    // Listen for sync events to reload entry
    function handleSyncEvent() {
        reloadEntry();
    }

    onMount(() => {
        // Listen for sync completion events
        if (browser) {
            window.addEventListener('journal-synced', handleSyncEvent);
            window.addEventListener('journal-entry-sync-status', handleSyncEvent as EventListener);
        }
    });

    onDestroy(() => {
        if (browser) {
            window.removeEventListener('journal-synced', handleSyncEvent);
            window.removeEventListener('journal-entry-sync-status', handleSyncEvent as EventListener);
        }
    });

    // Update current entry when prop changes - always update to ensure reactivity
    $effect(() => {
        // Always create a new object reference to ensure reactivity triggers
        if (initialEntry.id === currentEntry.id) {
            // Same entry: check if content actually changed
            const contentChanged = 
                initialEntry.content !== currentEntry.content ||
                initialEntry.title !== currentEntry.title ||
                initialEntry.updated !== currentEntry.updated;
            
            if (contentChanged) {
                currentEntry = { ...initialEntry };
            }
        } else {
            // Different entry: always update
            currentEntry = { ...initialEntry };
        }
    });
</script>

<Card class="h-full flex flex-col shadow-lg border-2">
    <CardHeader class="flex flex-row items-center justify-end border-b border-border pb-4 flex-shrink-0">
        <Button 
            variant="ghost" 
            size="icon" 
            class="h-8 w-8 flex-shrink-0"
            on:click={onClose}
            title="Close expanded view"
        >
            <X class="w-4 h-4" />
        </Button>
    </CardHeader>
    
    <CardContent class="flex-1 overflow-y-auto p-6 themed-scrollbar">
        <div class="max-w-3xl mx-auto">
            <EntryNode 
                entry={currentEntry}
                onEntryUpdate={handleEntryUpdate}
                onExpandEntry={undefined}
            />
        </div>
    </CardContent>
</Card>

<style>
    :global(.themed-scrollbar) {
        scrollbar-width: thin;
        scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
    }
    
    :global(.themed-scrollbar::-webkit-scrollbar) {
        width: 8px;
    }
    
    :global(.themed-scrollbar::-webkit-scrollbar-track) {
        background: transparent;
    }
    
    :global(.themed-scrollbar::-webkit-scrollbar-thumb) {
        background-color: rgba(155, 155, 155, 0.5);
        border-radius: 4px;
    }
    
    :global(.themed-scrollbar::-webkit-scrollbar-thumb:hover) {
        background-color: rgba(155, 155, 155, 0.7);
    }
</style>


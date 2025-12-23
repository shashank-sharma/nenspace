<script lang="ts">
    import type { LocalStreamEntry, EntryColor } from '../types';
    import { JournalStorageService } from '../services/journal-storage.service';
    import { JournalSyncService } from '../services/journal-sync.service.svelte';
    import { extractTitle } from '../utils/date.utils';
    import { Button } from '$lib/components/ui/button';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Label } from '$lib/components/ui/label';
    import * as Select from '$lib/components/ui/select';
    import { X } from 'lucide-svelte';
    import { authService } from '$lib/services/authService.svelte';
    import { SettingsService } from '$lib/services/settings.service.svelte';
    import { toast } from 'svelte-sonner';
    import { pb } from '$lib/config/pocketbase';

    let { entry, onClose, onSave } = $props<{
        entry?: LocalStreamEntry;
        onClose: () => void;
        onSave: () => void;
    }>();

    let content = $state(entry?.content || '');
    let entryColor = $state<EntryColor>(entry?.entry_color || 'grey');
    let isSaving = $state(false);

    async function handleSave() {
        if (!content.trim()) {
            toast.error('Entry content cannot be empty');
            return;
        }

        isSaving = true;
        try {
            const userId = authService.user?.id;
            if (!userId) {
                toast.error('You must be logged in to save entries');
                return;
            }

            const title = extractTitle(content);
            const { getCurrentDateTimeInTimezone, getCurrentDateInTimezone } = await import('../utils/date.utils');
            const userTimezone = SettingsService.account?.timezone;
            const now = getCurrentDateTimeInTimezone(userTimezone);
            const entryDate = entry?.entry_date || getCurrentDateInTimezone(userTimezone);

            const { generateEntryId } = await import('../utils/pocketbase-id.util');
            
            const entryData: LocalStreamEntry = {
                id: entry?.id || generateEntryId(), // Use PocketBase-style ID
                user: userId,
                content: content.trim(),
                title,
                entry_date: entryDate,
                entry_type: entry?.entry_type || 'manual',
                entry_color: entryColor,
                is_highlighted: entry?.is_highlighted || false,
                ai_context: entry?.ai_context,
                parent_entry: entry?.parent_entry,
                created: entry?.created || now,
                updated: now,
                syncStatus: entry?.syncStatus || 'pending',
                lastModified: Date.now(),
            };

            await JournalStorageService.saveEntry(entryData);
            
            // Use default color from settings if not set
            if (!entryData.entry_color && SettingsService.journal.defaultEntryColor) {
                entryData.entry_color = SettingsService.journal.defaultEntryColor;
            }
            
            await JournalSyncService.queueEntry(entryData);
            
            toast.success(entry ? 'Entry updated' : 'Entry created');
            onSave();
            onClose();
        } catch (error) {
            console.error('Failed to save entry:', error);
            toast.error('Failed to save entry');
        } finally {
            isSaving = false;
        }
    }

    async function handleDelete() {
        if (!entry) return;

        if (!confirm('Are you sure you want to delete this entry?')) {
            return;
        }

        try {
            await JournalSyncService.queueEntryDeletion(entry.id, true);
            toast.success('Entry deleted');
            onSave();
            onClose();
        } catch (error) {
            console.error('Failed to delete entry:', error);
            toast.error('Failed to delete entry');
        }
    }
</script>

<div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 class="text-lg font-semibold text-foreground">
                {entry ? 'Edit Entry' : 'New Entry'}
            </h2>
            <button
                class="p-2 hover:bg-gray-800 rounded transition-colors"
                onclick={onClose}
                type="button"
            >
                <X class="w-4 h-4 text-muted-foreground" />
            </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
            <div class="space-y-2">
                <Label for="content">Content</Label>
                <Textarea
                    id="content"
                    bind:value={content}
                    placeholder="Write your thoughts here..."
                    class="min-h-[200px] resize-none"
                    autofocus
                />
            </div>

            <div class="space-y-2">
                <Label for="color">Color</Label>
                <Select.Root
                    selected={{ value: entryColor, label: entryColor.charAt(0).toUpperCase() + entryColor.slice(1) }}
                    onSelectedChange={(selected) => {
                        if (selected && selected.value) {
                            entryColor = selected.value as EntryColor;
                        }
                    }}
                >
                    <Select.Trigger id="color">
                        <Select.Value placeholder="Select color" />
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value="grey">Grey</Select.Item>
                        <Select.Item value="orange">Orange</Select.Item>
                        <Select.Item value="blue">Blue</Select.Item>
                    </Select.Content>
                </Select.Root>
            </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between p-4 border-t border-gray-800">
            <div>
                {#if entry}
                    <Button
                        variant="destructive"
                        size="sm"
                        on:click={handleDelete}
                        disabled={isSaving}
                    >
                        Delete
                    </Button>
                {/if}
            </div>
            <div class="flex gap-2">
                <Button
                    variant="outline"
                    on:click={onClose}
                    disabled={isSaving}
                >
                    Cancel
                </Button>
                <Button
                    on:click={handleSave}
                    disabled={isSaving || !content.trim()}
                >
                    {isSaving ? 'Saving...' : entry ? 'Update' : 'Create'}
                </Button>
            </div>
        </div>
    </div>
</div>


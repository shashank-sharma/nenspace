<script lang="ts">
import * as Dialog from '$lib/components/ui/dialog';
import { Button } from '$lib/components/ui/button';
import type { EntryConflict, FieldDiff } from '../types';
import { Calendar, Clock, AlertTriangle } from 'lucide-svelte';

interface Props {
    open: boolean;
    conflict: EntryConflict | null;
    onresolve: (resolution: 'keep_local' | 'use_server' | 'manual') => void;
    onclose: () => void;
}

let { open = $bindable(), conflict, onresolve, onclose }: Props = $props();

let fieldDiffs = $state<FieldDiff[]>([]);
let showManualEditor = $state(false);
let manualContent = $state('');
let manualTitle = $state('');

// Calculate field differences
$effect(() => {
    if (!conflict) {
        fieldDiffs = [];
        return;
    }

    const diffs: FieldDiff[] = [];
    const { localEntry, serverEntry } = conflict;

    // Compare content
    diffs.push({
        field: 'content',
        localValue: localEntry.content,
        serverValue: serverEntry.content,
        isDifferent: localEntry.content !== serverEntry.content
    });

    // Compare title
    diffs.push({
        field: 'title',
        localValue: localEntry.title || '',
        serverValue: serverEntry.title || '',
        isDifferent: (localEntry.title || '') !== (serverEntry.title || '')
    });

    // Compare color
    diffs.push({
        field: 'entry_color',
        localValue: localEntry.entry_color || 'grey',
        serverValue: serverEntry.entry_color || 'grey',
        isDifferent: (localEntry.entry_color || 'grey') !== (serverEntry.entry_color || 'grey')
    });

    // Compare highlighted
    diffs.push({
        field: 'is_highlighted',
        localValue: localEntry.is_highlighted,
        serverValue: serverEntry.is_highlighted,
        isDifferent: localEntry.is_highlighted !== serverEntry.is_highlighted
    });

    fieldDiffs = diffs;
});

function formatTimestamp(timestamp: string | number): string {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function handleKeepLocal() {
    onresolve('keep_local');
}

function handleUseServer() {
    onresolve('use_server');
}

function handleManualMerge() {
    if (!conflict) return;
    
    // Initialize manual editor with local content
    manualContent = conflict.localEntry.content;
    manualTitle = conflict.localEntry.title || '';
    showManualEditor = true;
}

function handleSaveManual() {
    // For now, manual merge keeps local but could be extended
    // In a full implementation, this would update the entry with manual changes
    onresolve('manual');
}

function handleClose() {
    showManualEditor = false;
    onclose();
}

function getColorClass(color: string): string {
    const colorMap: Record<string, string> = {
        orange: 'bg-orange-100 text-orange-900 dark:bg-orange-900/20 dark:text-orange-400',
        blue: 'bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-400',
        green: 'bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-400',
        purple: 'bg-purple-100 text-purple-900 dark:bg-purple-900/20 dark:text-purple-400',
        pink: 'bg-pink-100 text-pink-900 dark:bg-pink-900/20 dark:text-pink-400',
        teal: 'bg-teal-100 text-teal-900 dark:bg-teal-900/20 dark:text-teal-400',
        yellow: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-400',
        grey: 'bg-gray-100 text-gray-900 dark:bg-gray-900/20 dark:text-gray-400',
    };
    return colorMap[color] || colorMap.grey;
}
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <Dialog.Header>
            <Dialog.Title class="flex items-center gap-2">
                <AlertTriangle class="w-5 h-5 text-yellow-500" />
                Sync Conflict Detected
            </Dialog.Title>
        </Dialog.Header>

        {#if conflict}
            <div class="flex-1 overflow-y-auto">
                {#if !showManualEditor}
                    <!-- Conflict Info -->
                    <div class="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-lg p-4 mb-4">
                        <p class="text-sm text-yellow-900 dark:text-yellow-200">
                            This entry has been modified both locally and on the server. 
                            Please choose which version to keep or merge them manually.
                        </p>
                    </div>

                    <!-- Side-by-side comparison -->
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Local Version -->
                        <div class="border rounded-lg p-4 bg-card">
                            <div class="flex items-center justify-between mb-3">
                                <h3 class="font-semibold text-sm">Your Local Version</h3>
                                <span class="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock class="w-3 h-3" />
                                    {formatTimestamp(conflict.localEntry.lastModified || conflict.localEntry.updated)}
                                </span>
                            </div>

                            <!-- Local Fields -->
                            {#each fieldDiffs as diff}
                                {#if diff.field === 'content'}
                                    <div class="mb-3">
                                        <label class="text-xs font-medium text-muted-foreground block mb-1">Content</label>
                                        <div class="text-sm p-2 rounded bg-background border {diff.isDifferent ? 'border-blue-500' : ''}">
                                            {diff.localValue}
                                        </div>
                                    </div>
                                {:else if diff.field === 'title'}
                                    <div class="mb-3">
                                        <label class="text-xs font-medium text-muted-foreground block mb-1">Title</label>
                                        <div class="text-sm p-2 rounded bg-background border {diff.isDifferent ? 'border-blue-500' : ''}">
                                            {diff.localValue || '(no title)'}
                                        </div>
                                    </div>
                                {:else if diff.field === 'entry_color'}
                                    <div class="mb-3">
                                        <label class="text-xs font-medium text-muted-foreground block mb-1">Color</label>
                                        <div class="inline-flex items-center gap-2 px-2 py-1 rounded text-xs {getColorClass(diff.localValue)} {diff.isDifferent ? 'ring-2 ring-blue-500' : ''}">
                                            {diff.localValue}
                                        </div>
                                    </div>
                                {:else if diff.field === 'is_highlighted'}
                                    <div class="mb-3">
                                        <label class="text-xs font-medium text-muted-foreground block mb-1">Highlighted</label>
                                        <div class="text-sm {diff.isDifferent ? 'text-blue-500 font-medium' : ''}">
                                            {diff.localValue ? 'Yes' : 'No'}
                                        </div>
                                    </div>
                                {/if}
                            {/each}
                        </div>

                        <!-- Server Version -->
                        <div class="border rounded-lg p-4 bg-card">
                            <div class="flex items-center justify-between mb-3">
                                <h3 class="font-semibold text-sm">Server Version</h3>
                                <span class="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock class="w-3 h-3" />
                                    {formatTimestamp(conflict.serverEntry.updated)}
                                </span>
                            </div>

                            <!-- Server Fields -->
                            {#each fieldDiffs as diff}
                                {#if diff.field === 'content'}
                                    <div class="mb-3">
                                        <label class="text-xs font-medium text-muted-foreground block mb-1">Content</label>
                                        <div class="text-sm p-2 rounded bg-background border {diff.isDifferent ? 'border-green-500' : ''}">
                                            {diff.serverValue}
                                        </div>
                                    </div>
                                {:else if diff.field === 'title'}
                                    <div class="mb-3">
                                        <label class="text-xs font-medium text-muted-foreground block mb-1">Title</label>
                                        <div class="text-sm p-2 rounded bg-background border {diff.isDifferent ? 'border-green-500' : ''}">
                                            {diff.serverValue || '(no title)'}
                                        </div>
                                    </div>
                                {:else if diff.field === 'entry_color'}
                                    <div class="mb-3">
                                        <label class="text-xs font-medium text-muted-foreground block mb-1">Color</label>
                                        <div class="inline-flex items-center gap-2 px-2 py-1 rounded text-xs {getColorClass(diff.serverValue)} {diff.isDifferent ? 'ring-2 ring-green-500' : ''}">
                                            {diff.serverValue}
                                        </div>
                                    </div>
                                {:else if diff.field === 'is_highlighted'}
                                    <div class="mb-3">
                                        <label class="text-xs font-medium text-muted-foreground block mb-1">Highlighted</label>
                                        <div class="text-sm {diff.isDifferent ? 'text-green-500 font-medium' : ''}">
                                            {diff.serverValue ? 'Yes' : 'No'}
                                        </div>
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    </div>

                    <!-- Legend -->
                    <div class="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                        <div class="flex items-center gap-1">
                            <div class="w-3 h-3 border-2 border-blue-500 rounded"></div>
                            <span>Local changes</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <div class="w-3 h-3 border-2 border-green-500 rounded"></div>
                            <span>Server changes</span>
                        </div>
                    </div>
                {:else}
                    <!-- Manual Merge Editor -->
                    <div class="space-y-4">
                        <div class="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-lg p-4">
                            <p class="text-sm text-blue-900 dark:text-blue-200">
                                Edit the entry below to merge both versions manually.
                            </p>
                        </div>

                        <div>
                            <label class="text-sm font-medium mb-2 block">Title</label>
                            <input
                                type="text"
                                bind:value={manualTitle}
                                class="w-full px-3 py-2 border rounded-lg bg-background"
                                placeholder="Entry title..."
                            />
                        </div>

                        <div>
                            <label class="text-sm font-medium mb-2 block">Content</label>
                            <textarea
                                bind:value={manualContent}
                                class="w-full px-3 py-2 border rounded-lg bg-background min-h-[200px] font-mono text-sm"
                                placeholder="Entry content..."
                            ></textarea>
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Actions -->
            <Dialog.Footer class="flex-shrink-0 mt-4">
                {#if !showManualEditor}
                    <div class="flex justify-between w-full gap-2">
                        <Button variant="outline" on:click={handleClose}>
                            Cancel
                        </Button>
                        <div class="flex gap-2">
                            <Button variant="default" on:click={handleKeepLocal}>
                                Keep Local
                            </Button>
                            <Button variant="secondary" on:click={handleUseServer}>
                                Use Server
                            </Button>
                            <Button variant="outline" on:click={handleManualMerge}>
                                Merge Manually
                            </Button>
                        </div>
                    </div>
                {:else}
                    <div class="flex justify-between w-full gap-2">
                        <Button variant="outline" on:click={() => showManualEditor = false}>
                            Back
                        </Button>
                        <Button variant="default" on:click={handleSaveManual}>
                            Save Merged Version
                        </Button>
                    </div>
                {/if}
            </Dialog.Footer>
        {/if}
    </Dialog.Content>
</Dialog.Root>


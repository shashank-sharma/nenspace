<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { JournalStorageService } from '../services/journal-storage.service';
    import { formatEntryDate, groupEntriesByDate, getStartOfDay, extractTitle } from '../utils/date.utils';
    import { JournalSyncService } from '../services/journal-sync.service.svelte';
    import EntryNode from './EntryNode.svelte';
    import EntryExpandedView from './EntryExpandedView.svelte';
    import JournalSyncStatus from './JournalSyncStatus.svelte';
    import ConflictResolutionModal from './ConflictResolutionModal.svelte';
    import { generateEntryId } from '../utils/pocketbase-id.util';
    import { authService } from '$lib/services/authService.svelte';
    import { SettingsService } from '$lib/services/settings.service.svelte';
    import { toast } from 'svelte-sonner';
    import { cn } from '$lib/utils';
    import type { LocalStreamEntry, EntryColor, EntryConflict } from '../types';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';

    // LocalStorage key for persisting expanded entry
    const EXPANDED_ENTRY_STORAGE_KEY = 'journal-expanded-entry-id';

    let { selectedDate } = $props<{
        selectedDate?: Date | null;
    }>();

    let entries = $state<LocalStreamEntry[]>([]);
    let groupedEntries = $state(new Map<string, LocalStreamEntry[]>());
    let isLoading = $state(false);
    let isInitialSync = $state(false);
    let currentDateLabel = $state('');
    let newEntryContent = $state('');
    let isSaving = $state(false);
    let conflictModalOpen = $state(false);
    let currentConflict = $state<EntryConflict | null>(null);
    let expandedEntry = $state<LocalStreamEntry | null>(null);
    
    // Define available colors
    const availableColors: EntryColor[] = ['grey', 'orange', 'blue', 'green', 'purple', 'pink', 'teal', 'yellow'];
    
    // Initialize with random color
    function getRandomColor(): EntryColor {
        return availableColors[Math.floor(Math.random() * availableColors.length)];
    }
    
    let entryColor = $state<EntryColor>(getRandomColor());
    
    // Cycle through colors when circle is clicked
    function cycleColor() {
        const currentIndex = availableColors.indexOf(entryColor);
        const nextIndex = (currentIndex + 1) % availableColors.length;
        entryColor = availableColors[nextIndex];
    }
    
    const entryColorClasses: Record<string, string> = {
        orange: 'bg-orange-500',
        blue: 'bg-blue-500',
        grey: 'bg-gray-500',
        green: 'bg-green-500',
        purple: 'bg-purple-500',
        pink: 'bg-pink-500',
        teal: 'bg-teal-500',
        yellow: 'bg-yellow-500',
    };

    async function loadEntries() {
        isLoading = true;
        try {
            const allEntries = await JournalStorageService.getAllEntriesSorted();
            entries = allEntries;
            groupedEntries = groupEntriesByDate(allEntries);
            
            if (selectedDate) {
                currentDateLabel = formatEntryDate(selectedDate);
            } else if (entries.length > 0) {
                // Show most recent entry date
                const mostRecent = entries[0];
                currentDateLabel = formatEntryDate(mostRecent.entry_date);
            }
        } catch (error) {
            console.error('Failed to load entries:', error);
        } finally {
            isLoading = false;
        }
    }

    // Helper to rebuild groupedEntries from current entries array
    function updateGroupedEntries() {
        groupedEntries = groupEntriesByDate(entries);
    }

    // Add entry optimistically without full reload
    function addEntryOptimistically(entry: LocalStreamEntry) {
        // Check if entry already exists (avoid duplicates)
        const exists = entries.some(e => e.id === entry.id);
        if (exists) {
            // Update existing entry
            entries = entries.map(e => e.id === entry.id ? entry : e);
        } else {
            // Add new entry and sort
            entries = [...entries, entry].sort((a, b) => {
                const dateA = new Date(a.entry_date).getTime();
                const dateB = new Date(b.entry_date).getTime();
                if (dateA !== dateB) {
                    return dateB - dateA; // Newest first
                }
                return new Date(b.created).getTime() - new Date(a.created).getTime();
            });
        }
        updateGroupedEntries();
        
        // Update current date label if needed
        if (!selectedDate && entries.length > 0) {
            const mostRecent = entries[0];
            currentDateLabel = formatEntryDate(mostRecent.entry_date);
        }
    }

    // Remove entry optimistically without full reload
    function removeEntryOptimistically(entryId: string) {
        // Remove entry and all its descendants (children, grandchildren, etc.)
        const entryIdsToRemove = new Set<string>([entryId]);
        
        // Find all descendant entries
        const findDescendants = (parentId: string) => {
            entries.forEach(entry => {
                if (entry.parent_entry === parentId) {
                    entryIdsToRemove.add(entry.id);
                    findDescendants(entry.id); // Recursively find children
                }
            });
        };
        findDescendants(entryId);
        
        // Remove all entries (entry + descendants)
        entries = entries.filter(e => !entryIdsToRemove.has(e.id));
        updateGroupedEntries();
        
        // Close expanded view if deleted entry is expanded
        if (expandedEntry && entryIdsToRemove.has(expandedEntry.id)) {
            expandedEntry = null;
        }
        
        // Update current date label if needed
        if (!selectedDate && entries.length > 0) {
            const mostRecent = entries[0];
            currentDateLabel = formatEntryDate(mostRecent.entry_date);
        }
    }

    // Preserve scroll position during async operations
    async function preserveScrollPosition(callback: () => Promise<void>) {
        const scrollElement = document.querySelector('.content-scroll-area') as HTMLElement;
        if (!scrollElement) {
            await callback();
            return;
        }
        
        const scrollTop = scrollElement.scrollTop;
        await callback();
        
        // Restore scroll position after a brief delay to allow DOM to update
        requestAnimationFrame(() => {
            if (scrollElement) {
                scrollElement.scrollTop = scrollTop;
            }
        });
    }

    function scrollToDate(date: Date) {
        const dateKey = getStartOfDay(date);
        const element = document.getElementById(`entry-group-${dateKey}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    $effect(() => {
        if (selectedDate) {
            currentDateLabel = formatEntryDate(selectedDate);
            scrollToDate(selectedDate);
        }
    });

    async function handleSaveEntry() {
        if (!newEntryContent.trim()) {
            return;
        }

        isSaving = true;
        try {
            const userId = authService.user?.id;
            if (!userId) {
                toast.error('You must be logged in to save entries');
                return;
            }

            const title = extractTitle(newEntryContent);
            const { getCurrentDateTimeInTimezone, getCurrentDateInTimezone } = await import('../utils/date.utils');
            const userTimezone = SettingsService.account?.timezone;
            const now = getCurrentDateTimeInTimezone(userTimezone);
            const entryDate = getCurrentDateInTimezone(userTimezone);

            const entryData: LocalStreamEntry = {
                id: generateEntryId(), // Use PocketBase-style ID
                user: userId,
                content: newEntryContent.trim(),
                title,
                entry_date: entryDate,
                entry_type: 'manual',
                entry_color: entryColor,
                is_highlighted: false,
                created: now,
                updated: now,
                syncStatus: 'pending',
                lastModified: Date.now(),
            };

            await JournalStorageService.saveEntry(entryData);
            await JournalSyncService.queueEntry(entryData);
            
            // Clear the input and reset to random color
            newEntryContent = '';
            entryColor = getRandomColor();
            
            // Add entry optimistically (no full reload, no scroll jump)
            addEntryOptimistically(entryData);
            
            toast.success('Entry created');
        } catch (error) {
            console.error('Failed to save entry:', error);
            toast.error('Failed to save entry');
        } finally {
            isSaving = false;
        }
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSaveEntry();
        }
    }

    function handleEntryUpdate(newEntry?: LocalStreamEntry, deletedEntryId?: string) {
        if (deletedEntryId) {
            // Optimistic deletion: remove entry without full reload
            removeEntryOptimistically(deletedEntryId);
        } else if (newEntry) {
            // Optimistic update: add/update entry without full reload
            addEntryOptimistically(newEntry);
            
            // Also update expanded entry if it's the same entry
            // Create new object reference to ensure reactivity
            if (expandedEntry && expandedEntry.id === newEntry.id) {
                expandedEntry = { ...newEntry };
            }
        } else {
            // Full reload for sync events or when entry not provided
            // Preserve scroll position during reload
            preserveScrollPosition(async () => {
                await loadEntries();
                
                // Also reload expanded entry if open
                if (expandedEntry) {
                    const updated = await JournalStorageService.getEntry(expandedEntry.id);
                    if (updated) {
                        // Create new object reference to ensure reactivity
                        expandedEntry = { ...updated };
                    } else {
                        // Entry was deleted
                        expandedEntry = null;
                    }
                }
            });
        }
    }

    // Listen for sync events to refresh entries
    function handleSyncEvent() {
        // Preserve scroll position during sync reload
        preserveScrollPosition(async () => {
            await loadEntries();
            
            // Also reload expanded entry if open
            if (expandedEntry) {
                const updated = await JournalStorageService.getEntry(expandedEntry.id);
                if (updated) {
                    // Create new object reference for reactivity
                    expandedEntry = { ...updated };
                } else {
                    // Entry was deleted
                    expandedEntry = null;
                }
            }
        });
    }

    // Handle conflict detected events
    function handleConflictDetected(event: CustomEvent) {
        const conflict = event.detail as EntryConflict;
        currentConflict = conflict;
        conflictModalOpen = true;
    }

    // Handle conflict resolution
    async function handleConflictResolve(resolution: 'keep_local' | 'use_server' | 'manual') {
        if (!currentConflict) return;
        
        try {
            await JournalSyncService.resolveUserConflict(currentConflict.entryId, resolution);
            conflictModalOpen = false;
            currentConflict = null;
            
            // Reload entries after resolution
            await loadEntries();
        } catch (error) {
            console.error('[ContentColumn] Failed to resolve conflict:', error);
            toast.error('Failed to resolve conflict');
        }
    }

    // Close conflict modal
    function handleConflictClose() {
        conflictModalOpen = false;
        // Keep currentConflict so user can re-open if needed
    }

    // Handle expanding an entry
    async function handleExpandEntry(entry: LocalStreamEntry) {
        // Reload entry from storage to get latest version
        const latestEntry = await JournalStorageService.getEntry(entry.id);
        if (latestEntry) {
            // Create new object reference for reactivity
            expandedEntry = { ...latestEntry };
            // Persist expanded entry ID to localStorage
            if (browser) {
                try {
                    localStorage.setItem(EXPANDED_ENTRY_STORAGE_KEY, entry.id);
                } catch (error) {
                    console.error('[ContentColumn] Failed to save expanded entry to localStorage:', error);
                }
            }
        } else {
            toast.error('Entry not found');
        }
    }

    // Handle closing expanded view
    function handleCloseExpandedView() {
        expandedEntry = null;
        // Clear persisted expanded entry from localStorage
        if (browser) {
            try {
                localStorage.removeItem(EXPANDED_ENTRY_STORAGE_KEY);
            } catch (error) {
                console.error('[ContentColumn] Failed to remove expanded entry from localStorage:', error);
            }
        }
    }

    // Handle entry updates (sync between views)
    async function handleEntryUpdateInExpanded(newEntry?: LocalStreamEntry) {
        if (newEntry && expandedEntry && newEntry.id === expandedEntry.id) {
            // Update expanded entry - create new object reference for reactivity
            expandedEntry = { ...newEntry };
        } else if (expandedEntry) {
            // Reload expanded entry from storage
            const updated = await JournalStorageService.getEntry(expandedEntry.id);
            if (updated) {
                // Create new object reference for reactivity
                expandedEntry = { ...updated };
            } else {
                // Entry was deleted
                toast.info('Entry was deleted');
                expandedEntry = null;
                // Clear persisted expanded entry from localStorage
                if (browser) {
                    try {
                        localStorage.removeItem(EXPANDED_ENTRY_STORAGE_KEY);
                    } catch (error) {
                        console.error('[ContentColumn] Failed to remove expanded entry from localStorage:', error);
                    }
                }
            }
        }
        
        // Also trigger main view update
        handleEntryUpdate(newEntry);
    }

    // Restore expanded entry from localStorage
    async function restoreExpandedEntry() {
        if (!browser) return;
        
        try {
            const savedEntryId = localStorage.getItem(EXPANDED_ENTRY_STORAGE_KEY);
            if (!savedEntryId) return;
            
            // Try to load the entry from storage
            const savedEntry = await JournalStorageService.getEntry(savedEntryId);
            if (savedEntry) {
                // Entry exists, restore the expanded view
                expandedEntry = { ...savedEntry };
            } else {
                // Entry doesn't exist anymore, clear from localStorage
                localStorage.removeItem(EXPANDED_ENTRY_STORAGE_KEY);
            }
        } catch (error) {
            // Gracefully handle any errors - just clear the saved entry
            console.error('[ContentColumn] Failed to restore expanded entry:', error);
            try {
                localStorage.removeItem(EXPANDED_ENTRY_STORAGE_KEY);
            } catch (clearError) {
                // Ignore errors when clearing
            }
        }
    }

    onMount(async () => {
        // Load local entries first
        await loadEntries();

        // If sync is enabled, perform initial pull sync
        const settings = SettingsService.journal;
        if (settings.syncEnabled && authService.user?.id) {
            isInitialSync = true;
            try {
                await JournalSyncService.pullFromServer();
                await loadEntries(); // Reload after pull
            } catch (error) {
                console.error('Initial sync failed:', error);
                // Don't show error toast on initial load, just log it
            } finally {
                isInitialSync = false;
            }
        }

        // Restore expanded entry from localStorage after entries are loaded
        await restoreExpandedEntry();

        // Listen for sync and conflict events
        if (browser) {
            window.addEventListener('journal-synced', handleSyncEvent);
            window.addEventListener('journal-conflict-detected', handleConflictDetected as EventListener);
        }
    });

    onDestroy(() => {
        if (browser) {
            window.removeEventListener('journal-synced', handleSyncEvent);
            window.removeEventListener('journal-conflict-detected', handleConflictDetected as EventListener);
        }
    });
</script>

<div class="h-full p-4 flex flex-col overflow-hidden">
    <div class="h-full flex flex-col md:flex-row gap-4">
        <!-- Original Content (left/top) -->
        <div class="flex-1 min-w-0 flex flex-col">
            <Card class="h-full flex flex-col shadow-lg">
        <!-- Header -->
        <CardHeader class="flex flex-row items-center justify-between border-b border-border pb-4">
            <div class="flex items-center gap-4">
                <CardTitle class="text-sm font-medium">
                    {currentDateLabel}
                </CardTitle>
                <span class="text-xs text-muted-foreground">
                    {entries.length} {entries.length === 1 ? 'entry' : 'entries'} in Stream
                </span>
            </div>
            <JournalSyncStatus />
        </CardHeader>

        <!-- Content -->
        <CardContent class="flex-1 overflow-y-auto p-6 content-scroll-area themed-scrollbar">
        <!-- Inline Entry Editor - aligned with entry timeline -->
        <div class="max-w-3xl mx-auto mb-8">
            <ol class="relative">
                <li class="mb-4 ms-6">
                    <div class="group flex gap-x-6">
                        <div class="relative">
                            <!-- Color circle (clickable to cycle colors) -->
                            <button
                                type="button"
                                onclick={cycleColor}
                                class={cn(
                                    "relative z-10 flex items-center justify-center w-6 h-6 rounded-full cursor-pointer hover:opacity-80 transition-opacity ring-8 ring-gray-950 dark:ring-gray-950",
                                    entryColorClasses[entryColor]
                                )}
                                title="Click to change color"
                                aria-label="Change entry color"
                                disabled={isSaving}
                            ></button>
                        </div>
                        
                        <!-- Input and save button -->
                        <div class="flex-1 flex items-center gap-2">
                            <input
                                type="text"
                                bind:value={newEntryContent}
                                placeholder="Write your thoughts here... (Cmd/Ctrl + Enter to save)"
                                class="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 focus:ring-0"
                                onkeydown={handleKeyDown}
                                disabled={isSaving}
                            />
                            <button
                                onclick={async () => await handleSaveEntry()}
                                disabled={isSaving || !newEntryContent.trim()}
                                class="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded transition-colors text-white flex-shrink-0"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </li>
            </ol>
        </div>
        {#if isLoading || isInitialSync}
            <div class="text-center text-muted-foreground">
                {isInitialSync ? 'Syncing entries...' : 'Loading entries...'}
            </div>
        {:else if entries.length === 0}
            <div class="text-center text-muted-foreground py-12">
                <p class="text-sm">No entries yet. Start writing your stream...</p>
            </div>
        {:else}
            <div class="max-w-3xl mx-auto">
                {#each Array.from(groupedEntries.entries()) as [dateKey, dateEntries]}
                    {@const date = new Date(dateKey)}
                    <div id="entry-group-{dateKey}" class="mb-8">
                        <h3 class="text-xs font-semibold text-muted-foreground mb-3">
                            {formatEntryDate(date)}
                        </h3>
                        <div class="space-y-2">
                            {#each dateEntries as entry (entry.id)}
                                {@const isParentEntry = !entry.parent_entry}
                                {#if isParentEntry}
                                    <EntryNode 
                                        entry={entry} 
                                        onEntryUpdate={handleEntryUpdate}
                                        onExpandEntry={handleExpandEntry}
                                    />
                                {/if}
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
        </CardContent>
    </Card>
        </div>
        
        <!-- Expanded View (right/bottom) -->
        {#if expandedEntry}
            <div class="md:w-1/2 w-full flex-shrink-0 flex flex-col">
                <EntryExpandedView 
                    entry={expandedEntry}
                    onClose={handleCloseExpandedView}
                    onEntryUpdate={handleEntryUpdateInExpanded}
                />
            </div>
        {/if}
    </div>
</div>

<!-- Conflict Resolution Modal -->
<ConflictResolutionModal 
    bind:open={conflictModalOpen}
    conflict={currentConflict}
    onresolve={handleConflictResolve}
    onclose={handleConflictClose}
/>


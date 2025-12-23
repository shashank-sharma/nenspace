<script lang="ts">
    import type { LocalStreamEntry } from '../types';
    import { getRelativeTime, extractTitle } from '../utils/date.utils';
    import { Sparkles, Sparkles as SparklesIcon, Plus, Trash2, CheckCircle, Clock, AlertCircle, CloudOff, MessageSquare, X, Loader2, WifiOff, AlertTriangle, ExternalLink } from 'lucide-svelte';
    import { cn } from '$lib/utils';
    import { generateAIReflection, askAI } from '../services/journal-ai.service';
    import { JournalStorageService } from '../services/journal-storage.service';
    import { JournalSyncService } from '../services/journal-sync.service.svelte';
    import { SettingsService } from '$lib/services/settings.service.svelte';
    import { NetworkService } from '$lib/services/network.service.svelte';
    import { generateEntryId } from '../utils/pocketbase-id.util';
    import { toast } from 'svelte-sonner';
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { Textarea } from '$lib/components/ui/textarea';
    import { authService } from '$lib/services/authService.svelte';
    import EntryNode from './EntryNode.svelte';

    let { entry, isHighlighted = false, onEntryUpdate, isChild = false, onRequestAddChild, isRootAddingChild = false, isRootAskingAI = false, onExpandEntry, hideChildren = false } = $props<{
        entry: LocalStreamEntry;
        isHighlighted?: boolean;
        onEntryUpdate?: (newEntry?: LocalStreamEntry, deletedEntryId?: string) => void;
        isChild?: boolean; // If true, render as <li> only, not wrapped in <ol>
        onRequestAddChild?: (rootParentId: string) => void; // Callback to request root parent to show input
        isRootAddingChild?: boolean; // If true, the root parent is currently adding a child
        isRootAskingAI?: boolean; // If true, the root parent is currently asking AI
        onExpandEntry?: (entry: LocalStreamEntry) => void; // Callback to expand entry in separate view
        hideChildren?: boolean; // If true, don't render children (used in collapsed view)
    }>();

    let isEditing = $state(false);
    let isAddingChild = $state(false);
    let editingChildId: string | null = $state(null); // Track which child is being edited
    let isGeneratingReflection = $state(false);
    let isAskingAI = $state(false);
    let isAskingAIInput = $state(false);
    let aiQuery = $state('');
    let childEntries = $state<LocalStreamEntry[]>([]);
    let editedContent = $state('');
    let childContent = $state('');
    let isSaving = $state(false);
    let allThreadEntries = $state<LocalStreamEntry[]>([]); // All entries in this thread
    let currentEntry = $state(entry); // Track current entry state for sync updates
    
    // Track if we're manually updating currentEntry to prevent $effect from overwriting fresh state
    // This prevents race conditions where manual updates (from sync events) get overwritten by stale props
    let isManuallyUpdating = false;
    
    // Sync currentEntry with entry prop, but only when appropriate to avoid overwriting fresh sync state
    $effect(() => {
        if (isManuallyUpdating) {
            return; // Skip to prevent overwriting manual updates
        }
        
        if (entry.id === currentEntry.id) {
            // Same entry: only update if content changed or prop has higher sync status priority
            // Priority: 'synced' > 'pending' > 'failed' (prevents downgrading from synced to pending)
            const syncStatusPriority: Record<string, number> = { 'synced': 3, 'pending': 2, 'failed': 1 };
            const currentPriority = syncStatusPriority[currentEntry.syncStatus || 'pending'] || 0;
            const propPriority = syncStatusPriority[entry.syncStatus || 'pending'] || 0;
            
            const contentChanged = 
                entry.content !== currentEntry.content ||
                entry.title !== currentEntry.title ||
                entry.updated !== currentEntry.updated;
            
            if (contentChanged || propPriority > currentPriority) {
                currentEntry = { ...entry };
            }
        } else {
            // Different entry: always update
            currentEntry = { ...entry };
        }
    });
    
    const journalSettings = SettingsService.journal;
    
    // Threshold for showing "View All" button
    const CHILDREN_EXPAND_THRESHOLD = 5;
    
    // Computed: Check if we should show "View All" button
    const shouldShowViewAll = $derived(
        !isChild && 
        childEntries.length > CHILDREN_EXPAND_THRESHOLD && 
        !!onExpandEntry
    );
    
    // Computed: Show first + last child when there are more than 5 children (for main view only, not in expanded view)
    const shouldShowFirstLast = $derived(
        !isChild && 
        childEntries.length > 5 &&
        !!onExpandEntry // Only collapse if expand functionality is available (not in expanded view)
    );
    
    // Computed: Visible children - show first + last if shouldShowFirstLast, otherwise show all
    const visibleChildren = $derived.by(() => {
        if (shouldShowFirstLast) {
            // Show first and last child only - ensure they're different to avoid duplicate keys
            const first = childEntries[0];
            const last = childEntries[childEntries.length - 1];
            // If first and last are the same (edge case), just return first
            if (first.id === last.id) {
                return [first];
            }
            return [first, last];
        } else {
            // Show all children (when 5 or fewer children)
            return childEntries;
        }
    });
    
    // Computed: Count of hidden children (middle ones when showing first + last)
    const hiddenChildrenCount = $derived.by(() => {
        if (shouldShowFirstLast) {
            // Middle children (excluding first and last)
            return childEntries.length - 2;
        } else {
            return 0;
        }
    });
    
    // Computed: Check if we're showing a collapsed view (first + last)
    const isShowingCollapsedView = $derived(shouldShowFirstLast);
    
    // Computed: Get the true last entry in the entire thread (not just direct children)
    // This finds the chronologically last entry in allThreadEntries (excluding the root entry itself)
    const trueLastEntryInThread = $derived.by(() => {
        if (allThreadEntries.length === 0) return null;
        // Exclude the root entry itself (entry.id) and find the last entry
        const threadEntriesExcludingRoot = allThreadEntries.filter(e => e.id !== entry.id);
        if (threadEntriesExcludingRoot.length === 0) return null;
        // Return the last entry (already sorted by creation time)
        return threadEntriesExcludingRoot[threadEntriesExcludingRoot.length - 1];
    });
    
    // Derived sync status for reactivity
    const entrySyncStatus = $derived(currentEntry.syncStatus);
    const entryIsSyncing = $derived(currentEntry.isSyncing);
    
    // Computed: Check if entry is synced and AI features are available
    const isEntrySynced = $derived(
        entrySyncStatus === 'synced' && 
        !entryIsSyncing
    );
    
    const canUseAI = $derived(
        isEntrySynced && 
        NetworkService.isOnline && 
        journalSettings.aiReflectionsEnabled
    );
    
    const syncStatusText = $derived.by(() => {
        if (!NetworkService.isOnline) return 'Offline - AI requires connection';
        if (entryIsSyncing) return 'Syncing entry...';
        if (entrySyncStatus === 'pending') return 'Waiting to sync...';
        if (entrySyncStatus === 'failed') return 'Sync failed - retry required';
        if (!entrySyncStatus || entrySyncStatus !== 'synced') return 'Entry not synced yet';
        return '';
    });

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

    const timelineLineColorClasses: Record<string, string> = {
        orange: 'bg-orange-400',
        blue: 'bg-blue-400',
        grey: 'bg-gray-400',
        green: 'bg-green-400',
        purple: 'bg-purple-400',
        pink: 'bg-pink-400',
        teal: 'bg-teal-400',
        yellow: 'bg-yellow-400',
    };

    // Use currentEntry for display to ensure reactivity when entry is updated
    const entryColor = $derived(currentEntry.entry_color || 'grey');
    const isAIReflection = $derived(currentEntry.entry_type === 'ai_reflection' || currentEntry.entry_type === 'ai_expanded');
    const isAIExpanded = $derived(currentEntry.entry_type === 'ai_expanded');
    const relativeTime = $derived(getRelativeTime(currentEntry.created));
    
    // Ensure content is always a string (defensive check) - use currentEntry for reactivity
    const safeContent = $derived(currentEntry.content || '');
    
    // Initialize edited content when currentEntry changes
    $effect(() => {
        if (!isEditing) {
            editedContent = currentEntry.content || '';
        }
    });
    
    // Parse AI expanded entries to extract question and answer
    const questionText = $derived.by(() => {
        if (!isAIExpanded) return '';
        // Try to parse "Q: ...\n\nA: ..." format
        const qaMatch = safeContent.match(/^Q:\s*(.+?)\n\nA:\s*(.+)$/s);
        if (qaMatch) {
            return qaMatch[1].trim();
        }
        // Fallback: use ai_context.user_query if available
        return currentEntry.ai_context?.user_query || '';
    });
    
    const answerText = $derived.by(() => {
        if (!isAIExpanded) return '';
        // Try to parse "Q: ...\n\nA: ..." format
        const qaMatch = safeContent.match(/^Q:\s*(.+?)\n\nA:\s*(.+)$/s);
        if (qaMatch) {
            return qaMatch[2].trim();
        }
        // Fallback: use full content
        return safeContent;
    });
    
    // Split content into first line (title) and rest - use derived for reactivity
    const firstLine = $derived.by(() => {
        const lines = safeContent.split('\n');
        return lines[0] || '';
    });
    const restContent = $derived.by(() => {
        const lines = safeContent.split('\n');
        return lines.slice(1).join('\n').trim();
    });

    // Find root parent (entry with no parent_entry)
    function findRootParent(entryId: string, allEntries: LocalStreamEntry[]): string {
        let currentEntry = allEntries.find(e => e.id === entryId);
        if (!currentEntry) return entryId;
        
        while (currentEntry.parent_entry) {
            const parent = allEntries.find(e => e.id === currentEntry!.parent_entry);
            if (!parent) break;
            currentEntry = parent;
        }
        return currentEntry.id;
    }

    async function loadChildEntries() {
        try {
            const allEntries = await JournalStorageService.getAllEntries();
            
            // Find root parent
            const rootParentId = findRootParent(entry.id, allEntries);
            
            // Load all entries in this thread (root + all children)
            allThreadEntries = allEntries.filter(e => {
                const eRootId = findRootParent(e.id, allEntries);
                return eRootId === rootParentId;
            });
            
            // Sort by creation time
            allThreadEntries.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
            
            // Find direct children of this entry (regardless of whether this entry is a root or child)
            // This allows nested children (e.g., AI reflection can have AI expanded as child)
            // Include ALL children regardless of type (manual, ai_reflection, ai_expanded, etc.)
            childEntries = allThreadEntries.filter(e => e.parent_entry === entry.id);
            
            // Ensure childEntries is sorted by creation time (regardless of type)
            // This ensures first and last entries are shown correctly in collapsed view
            childEntries.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
        } catch (error) {
            console.error('Failed to load child entries:', error);
        }
    }

    // Check if this entry is the last in the thread (chronologically last entry)
    const isLastInThread = $derived(
        allThreadEntries.length === 0 
            ? true 
            : allThreadEntries[allThreadEntries.length - 1].id === entry.id
    );

    // Check if this is the root entry (no parent)
    const isRootEntry = !entry.parent_entry;

    // Handle request to add child - if this is a child entry, notify root parent
    async function handleRequestAddChild() {
        // If this is a child entry (has a parent), find root parent and request it to show input
        if (!isRootEntry) {
            const allEntries = await JournalStorageService.getAllEntries();
            const rootParentId = findRootParent(entry.id, allEntries);
            onRequestAddChild?.(rootParentId);
        } else {
            // This is the root entry - show input directly
            isAddingChild = true;
            editingChildId = null; // Clear any editing state
            childContent = '';
        }
    }

    // Handle request to edit a child entry
    function handleEditChild(childId: string) {
        const childToEdit = childEntries.find(c => c.id === childId);
        if (childToEdit) {
            editingChildId = childId;
            childContent = childToEdit.content || '';
            isAddingChild = true;
        }
    }

    function handleRequestAskAI() {
        isAskingAIInput = true;
        aiQuery = '';
    }

    async function handleSaveEdit() {
        if (!editedContent.trim()) {
            toast.error('Entry content cannot be empty');
            return;
        }

        isSaving = true;
        try {
            const title = extractTitle(editedContent);
            const now = new Date().toISOString();
            const updatedEntry: LocalStreamEntry = {
                ...entry,
                content: editedContent.trim(),
                title,
                updated: now,
                lastModified: Date.now(),
                // Preserve syncStatus: if entry was synced, keep it as 'synced' so sync service knows to UPDATE
                // If it was pending/failed, keep that status so it gets created/retried
                syncStatus: entry.syncStatus || 'pending',
            };

            await JournalStorageService.saveEntry(updatedEntry);
            // If entry was already synced, mark as pending to trigger re-sync with updated content
            // The sync service will check if entry exists on server to determine UPDATE vs CREATE
            if (entry.syncStatus === 'synced') {
                updatedEntry.syncStatus = 'pending';
                await JournalStorageService.saveEntry(updatedEntry);
            }
            await JournalSyncService.queueEntry(updatedEntry);
            
            // Update currentEntry immediately for reactivity (before calling onEntryUpdate)
            // Set flag to prevent $effect from overwriting this update
            isManuallyUpdating = true;
            currentEntry = { ...updatedEntry };
            
            isEditing = false;
            // Pass updated entry to parent for optimistic update
            onEntryUpdate?.(updatedEntry);
            
            // Reset flag after a brief delay to allow parent to update prop
            setTimeout(() => {
                isManuallyUpdating = false;
            }, 100);
            
            toast.success('Entry updated');
        } catch (error) {
            console.error('Failed to save entry:', error);
            toast.error('Failed to save entry');
        } finally {
            isSaving = false;
        }
    }

    async function handleSaveChild() {
        if (!childContent.trim()) {
            toast.error('Child entry content cannot be empty');
            return;
        }

        isSaving = true;
        try {
            const userId = authService.user?.id;
            if (!userId) {
                toast.error('You must be logged in to save entries');
                return;
            }

            const title = extractTitle(childContent);
            const { getCurrentDateTimeInTimezone, getCurrentDateInTimezone } = await import('../utils/date.utils');
            const userTimezone = SettingsService.account?.timezone;
            const now = getCurrentDateTimeInTimezone(userTimezone);
            const entryDate = getCurrentDateInTimezone(userTimezone);

            // Check if we're editing an existing child entry
            if (editingChildId) {
                // Update existing child entry
                const existingChild = await JournalStorageService.getEntry(editingChildId);
                if (!existingChild) {
                    toast.error('Child entry not found');
                    editingChildId = null;
                    isAddingChild = false;
                    childContent = '';
                    return;
                }

                const updatedChild: LocalStreamEntry = {
                    ...existingChild,
                    content: childContent.trim(),
                    title,
                    updated: now,
                    lastModified: Date.now(),
                };

                await JournalStorageService.saveEntry(updatedChild);
                await JournalSyncService.queueEntry(updatedChild);
                
                // Update local state
                childEntries = childEntries.map(c => c.id === editingChildId ? updatedChild : c).sort((a, b) => 
                    new Date(a.created).getTime() - new Date(b.created).getTime()
                );
                
                allThreadEntries = allThreadEntries.map(e => e.id === editingChildId ? updatedChild : e).sort((a, b) => 
                    new Date(a.created).getTime() - new Date(b.created).getTime()
                );
                
                childContent = '';
                editingChildId = null;
                isAddingChild = false;
                toast.success('Child entry updated');
            } else {
                // Create new child entry
                // Find root parent - all children go to the root parent for linear structure
                const allEntries = await JournalStorageService.getAllEntries();
                const rootParentId = findRootParent(entry.id, allEntries);
                const rootParent = allEntries.find(e => e.id === rootParentId);

                // Ensure parent is synced before creating child
                let finalParentId = rootParentId;
                if (rootParent && rootParent.syncStatus !== 'synced') {
                    if (NetworkService.isOnline) {
                        toast.info('Syncing parent entry...');
                        try {
                            const syncedParent = await JournalSyncService.ensureEntrySynced(rootParentId);
                            finalParentId = syncedParent.id;
                        } catch (error) {
                            console.error('[EntryNode] Failed to sync parent before creating child:', error);
                            toast.error('Failed to sync parent entry. Child will be created with current parent ID.');
                            // Continue with current parent ID - will be fixed on sync
                        }
                    } else {
                        // Offline: use current parent ID, will be fixed on sync
                        finalParentId = rootParentId;
                    }
                }

                const childEntry: LocalStreamEntry = {
                    id: generateEntryId(), // Use PocketBase-style ID
                    user: userId,
                    content: childContent.trim(),
                    title,
                    entry_date: entryDate,
                    entry_type: 'manual',
                    entry_color: entry.entry_color || 'grey',
                    is_highlighted: false,
                    parent_entry: finalParentId,
                    created: now,
                    updated: now,
                    syncStatus: 'pending',
                    lastModified: Date.now(),
                };

                await JournalStorageService.saveEntry(childEntry);
                await JournalSyncService.queueEntry(childEntry);
                
                childContent = '';
                isAddingChild = false;
                
                // Add child optimistically to local state
                childEntries = [...childEntries, childEntry].sort((a, b) => 
                    new Date(a.created).getTime() - new Date(b.created).getTime()
                );
                
                // Also update thread entries
                allThreadEntries = [...allThreadEntries, childEntry].sort((a, b) => 
                    new Date(a.created).getTime() - new Date(b.created).getTime()
                );
                
                toast.success('Child entry created');
            }
        } catch (error) {
            console.error('Failed to save child entry:', error);
            toast.error('Failed to save child entry');
        } finally {
            isSaving = false;
        }
    }

    async function handleGenerateReflection() {
        if (isGeneratingReflection) return;
        
        isGeneratingReflection = true;
        try {
            // Try to ensure entry is synced first
            if (!isEntrySynced) {
                toast.info('Syncing entry before generating AI reflection...');
                const synced = await JournalSyncService.ensureEntrySynced(currentEntry.id);
                currentEntry = synced;
            }
            
            const reflectionEntry = await generateAIReflection(currentEntry);
            await JournalStorageService.saveEntry(reflectionEntry);
            await JournalSyncService.queueEntry(reflectionEntry);
            toast.success('AI reflection generated');
            // Pass reflection entry to parent for optimistic update
            onEntryUpdate?.(reflectionEntry);
        } catch (error) {
            console.error('Failed to generate AI reflection:', error);
            const errorMsg = error instanceof Error ? error.message : 'Failed to generate AI reflection';
            toast.error(errorMsg);
        } finally {
            isGeneratingReflection = false;
        }
    }

    async function handleAskAI() {
        if (!aiQuery.trim() || isAskingAI) return;
        
        isAskingAI = true;
        isAskingAIInput = false;
        
        try {
            // Try to ensure entry is synced first
            if (!isEntrySynced) {
                toast.info('Syncing entry before asking AI...');
                const synced = await JournalSyncService.ensureEntrySynced(currentEntry.id);
                currentEntry = synced;
            }
            
            // Get thread IDs for context
            const threadIds = allThreadEntries.map(e => e.id);
            
            const aiResponseEntry = await askAI(currentEntry, aiQuery.trim(), threadIds);
            await JournalStorageService.saveEntry(aiResponseEntry);
            await JournalSyncService.queueEntry(aiResponseEntry);
            toast.success('AI response generated');
            aiQuery = '';
            
            // Reload child entries to ensure AI response is included (it should have parent_entry === currentEntry.id)
            // This ensures the AI response appears in childEntries and is sorted correctly
            await loadChildEntries();
            
            // AI expanded entries are children, handled locally, no need to call onEntryUpdate (would trigger full reload)
        } catch (error) {
            console.error('Failed to ask AI:', error);
            const errorMsg = error instanceof Error ? error.message : 'Failed to get AI response';
            toast.error(errorMsg);
            isAskingAIInput = true; // Reopen input on error
        } finally {
            isAskingAI = false;
        }
    }

    async function handleDelete() {
        if (!confirm('Are you sure you want to delete this entry?')) {
            return;
        }
        try {
            const entryIdToDelete = entry.id;
            await JournalSyncService.queueEntryDeletion(entryIdToDelete, true);
            toast.success('Entry deleted');
            // Pass deleted entry ID for optimistic removal (maintains scroll position)
            onEntryUpdate?.(undefined, entryIdToDelete);
        } catch (error) {
            console.error('Failed to delete entry:', error);
            toast.error('Failed to delete entry');
        }
    }

    // Reload children and entry state when sync completes
    async function handleSyncEvent() {
        loadChildEntries();
        // Reload entry to get updated sync status, preventing $effect from overwriting
        isManuallyUpdating = true;
        const updated = await JournalStorageService.getEntry(currentEntry.id);
        if (updated) {
            currentEntry = { ...updated };
            setTimeout(() => {
                isManuallyUpdating = false;
            }, 100);
        } else {
            isManuallyUpdating = false;
        }
    }

    // Listen for entry-specific sync status updates
    function handleEntrySyncStatus(event: Event) {
        const customEvent = event as CustomEvent<{ entryId: string; status: string }>;
        const { entryId } = customEvent.detail;
        
        if (entryId === currentEntry.id) {
            // Reload entry from storage (source of truth) and prevent $effect from overwriting
            isManuallyUpdating = true;
            JournalStorageService.getEntry(entryId).then(updated => {
                if (updated) {
                    currentEntry = { ...updated };
                    // Brief delay allows reactivity to settle before re-enabling $effect
                    setTimeout(() => {
                        isManuallyUpdating = false;
                    }, 100);
                } else {
                    isManuallyUpdating = false;
                }
            }).catch(err => {
                console.error(`[EntryNode] Failed to reload entry ${entryId}:`, err);
                isManuallyUpdating = false;
            });
        }
    }

    onMount(() => {
        loadChildEntries();
        
        if (browser) {
            // Listen for sync events to update entry state reactively
            window.addEventListener('journal-synced', handleSyncEvent);
            window.addEventListener('journal-entry-sync-status', handleEntrySyncStatus);
            
            // Check if entry was synced before component mounted (e.g., during initial load)
            isManuallyUpdating = true;
            JournalStorageService.getEntry(currentEntry.id).then(updated => {
                if (updated && updated.syncStatus !== currentEntry.syncStatus) {
                    currentEntry = { ...updated };
                    setTimeout(() => {
                        isManuallyUpdating = false;
                    }, 100);
                } else {
                    isManuallyUpdating = false;
                }
            });
        }
    });

    onDestroy(() => {
        if (browser) {
            window.removeEventListener('journal-synced', handleSyncEvent);
            window.removeEventListener('journal-entry-sync-status', handleEntrySyncStatus);
        }
    });

    // Reload children when entry prop changes (e.g., after sync)
    $effect(() => {
        // Track entry.id to reload when entry changes
        const currentEntryId = entry.id;
        loadChildEntries();
    });

    // Reactive derived values for timeline line visibility
    const shouldShowLineForRoot = $derived(!isLastInThread || isAddingChild || isAskingAIInput);
    const shouldShowLineForChild = $derived(!isLastInThread || isRootAddingChild || isRootAskingAI || isAskingAIInput);
    // Input badges should never show a line below them - they're at the end of the visual timeline
    const shouldShowLineForInput = $derived(false);

    // Helper function to determine if vertical line should show
    function shouldShowTimelineLine(isInput: boolean = false): boolean {
        if (isInput) {
            return shouldShowLineForInput;
        }
        // For root entry, show if not last OR adding child OR asking AI
        if (!isChild) {
            return shouldShowLineForRoot;
        }
        // For child entry, show if not last OR if root is adding child or asking AI
        return shouldShowLineForChild;
    }

    // Get timeline line width based on context
    function getTimelineLineWidth(isInput: boolean = false): string {
        return isInput ? 'w-0.25' : 'w-0.5';
    }
</script>

<!-- Snippet: Timeline Badge with Vertical Line -->
{#snippet timelineBadge(isInput: boolean = false)}
    <div class="relative">
        {#if isInput ? shouldShowLineForInput : (!isChild ? shouldShowLineForRoot : shouldShowLineForChild)}
            <div class={cn(
                "absolute left-1/2 top-0 -translate-x-1/2",
                getTimelineLineWidth(isInput),
                timelineLineColorClasses[entryColor],
                // Input lines are taller, root entry badge lines extend when adding child or asking AI
                isInput ? "h-[100%]" : (isAddingChild || isAskingAIInput) ? "h-[100%]" : "h-[100%]"
            )}></div>
        {/if}
        <span class={cn(
            "relative z-10 flex items-center justify-center w-6 h-6 rounded-full ring-8 ring-gray-950 dark:ring-gray-950",
            entryColorClasses[entryColor],
            isHighlighted && !isInput && "ring-yellow-400"
        )}>
            {#if isAIReflection && !isInput}
                <Sparkles class="w-3 h-3 text-white" />
            {/if}
        </span>
    </div>
{/snippet}

<!-- Snippet: Entry Content Display/Edit -->
{#snippet entryContent()}
    <div class="group">
        <div class="flex items-start justify-between gap-4 mb-2">
            <div class="flex-1">
                {#if isEditing}
                    <Textarea
                        bind:value={editedContent}
                        class="min-h-[100px] resize-none bg-transparent border-gray-700 text-foreground mb-2"
                        placeholder="Edit your entry..."
                    />
                    <div class="flex gap-2">
                        <button
                            class="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
                            onclick={handleSaveEdit}
                            disabled={isSaving || !editedContent.trim()}
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                            class="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-foreground"
                            onclick={() => {
                                isEditing = false;
                                editedContent = currentEntry.content || '';
                            }}
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                    </div>
                {:else}
                    {#if isAIExpanded && questionText && answerText}
                        <!-- Special formatting for AI expanded entries -->
                        <div class="space-y-3">
                            <div class="border-l-2 border-blue-500/30 pl-3">
                                <p class="text-xs font-medium text-muted-foreground mb-1">Question</p>
                                <p class="text-sm text-foreground/90 italic">{questionText}</p>
                            </div>
                            <div>
                                <p class="text-xs font-medium text-muted-foreground mb-1">Answer</p>
                                <p class="text-sm text-foreground whitespace-pre-wrap">{answerText}</p>
                            </div>
                        </div>
                    {:else}
                        <!-- Standard entry display -->
                        {#if firstLine}
                            <p class="text-foreground mb-2">{firstLine}</p>
                        {/if}
                        {#if restContent}
                            <p class="text-sm text-muted-foreground whitespace-pre-wrap">{restContent}</p>
                        {/if}
                    {/if}
                {/if}
            </div>
            <div class="flex items-center gap-2">
                {#if entryIsSyncing}
                    <div title="Syncing...">
                        <Loader2 class="w-3 h-3 text-blue-500 animate-spin" />
                    </div>
                {:else if entrySyncStatus === 'pending'}
                    <div title="Pending sync">
                        <Clock class="w-3 h-3 text-yellow-500" />
                    </div>
                {:else if entrySyncStatus === 'failed'}
                    <div title="Sync failed - click to retry" class="cursor-pointer" onclick={() => JournalSyncService.ensureEntrySynced(currentEntry.id).then(s => currentEntry = { ...s }).catch(console.error)}>
                        <AlertTriangle class="w-3 h-3 text-destructive" />
                    </div>
                {:else if entrySyncStatus === 'synced'}
                    <div title="Synced">
                        <CheckCircle class="w-3 h-3 text-green-500/70" />
                    </div>
                {:else if !NetworkService.isOnline}
                    <div title="Offline">
                        <WifiOff class="w-3 h-3 text-muted-foreground" />
                    </div>
                {:else}
                    <div title="Not synced">
                        <CloudOff class="w-3 h-3 text-muted-foreground/50" />
                    </div>
                {/if}
                <time class="text-xs text-muted-foreground">
                    {relativeTime}
                </time>
            </div>
        </div>
        {@render editMenu()}
    </div>
{/snippet}

<!-- Snippet: Edit Menu -->
{#snippet editMenu()}
    <div class="edit-menu-container">
        {#if !isEditing && !isAddingChild && !isAskingAIInput && (!isChild || !isRootAddingChild)}
            <div class="edit-menu-content">
                {#if isLastInThread && (!isChild || !isRootAddingChild)}
                    <button
                        class="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        onclick={handleRequestAddChild}
                    >
                        <Plus class="w-3 h-3" />
                        Add Child
                    </button>
                {/if}
                
                {#if journalSettings.aiReflectionsEnabled && entry.entry_type === 'manual' && isLastInThread}
                    <button
                        class="text-xs flex items-center gap-1 {canUseAI ? 'text-muted-foreground hover:text-blue-400 rainbow-text' : 'text-muted-foreground/50 cursor-not-allowed'}"
                        onclick={handleGenerateReflection}
                        disabled={!canUseAI || isGeneratingReflection}
                        title={canUseAI ? '' : syncStatusText}
                    >
                        <SparklesIcon class="w-3 h-3" />
                        {isGeneratingReflection ? 'Generating...' : 'AI Reflect'}
                    </button>
                {/if}
                
                {#if journalSettings.aiReflectionsEnabled && isLastInThread}
                    <button
                        class="text-xs flex items-center gap-1 {canUseAI ? 'text-muted-foreground hover:text-blue-400 rainbow-text' : 'text-muted-foreground/50 cursor-not-allowed'}"
                        onclick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRequestAskAI();
                        }}
                        disabled={!canUseAI || isAskingAI || isGeneratingReflection}
                        type="button"
                        title={canUseAI ? '' : syncStatusText}
                    >
                        <MessageSquare class="w-3 h-3" />
                        Ask AI
                    </button>
                {/if}
                
                <button
                    class="text-xs text-muted-foreground hover:text-foreground"
                    onclick={() => {
                        isEditing = true;
                        editedContent = currentEntry.content || '';
                    }}
                >
                    Edit
                </button>
                
                <button
                    class="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                    onclick={handleDelete}
                >
                    <Trash2 class="w-3 h-3" />
                    Delete
                </button>
            </div>
        {/if}
    </div>
{/snippet}

{#if isChild}
    <!-- Render as <li> only (for child entries) -->
    <li class="ms-6">
        <div class="group flex gap-x-6">
            {@render timelineBadge()}
            <div class="flex-1">
                {@render entryContent()}
            </div>
        </div>
    </li>
    
    <!-- Render children of child entries (e.g., AI expanded under AI reflection) -->
    {#if !hideChildren && (visibleChildren.length > 0 || isAskingAIInput)}
        <ol class="relative">
            {#each visibleChildren as childEntry (childEntry.id)}
                <EntryNode 
                    entry={childEntry} 
                    isHighlighted={isHighlighted}
                    onEntryUpdate={onEntryUpdate}
                    isChild={true}
                    isRootAddingChild={isAddingChild}
                    isRootAskingAI={isAskingAIInput}
                    onRequestAddChild={(rootId) => {
                        // If this root entry matches the requested root, show input
                        if (rootId === entry.id) {
                            isAddingChild = true;
                            childContent = '';
                        } else {
                            // Otherwise, bubble up to parent
                            onRequestAddChild?.(rootId);
                        }
                    }}
                />
            {/each}
            
            {#if hiddenChildrenCount > 0}
                <li class="ms-6 mt-2 mb-2">
                    <div class="text-xs text-muted-foreground italic">
                        ... and {hiddenChildrenCount} more {hiddenChildrenCount === 1 ? 'child' : 'children'}
                    </div>
                    {#if shouldShowViewAll}
                        <button
                            class="text-xs text-muted-foreground hover:text-blue-400 flex items-center gap-1 mt-1"
                            onclick={() => onExpandEntry?.(entry)}
                            title="View all {childEntries.length} children"
                        >
                            <ExternalLink class="w-3 h-3" />
                            View All ({childEntries.length})
                        </button>
                    {/if}
                </li>
            {/if}
        </ol>
    {/if}
    
    <!-- Ask AI input for child entries -->
    {#if !hideChildren && isAskingAIInput}
        <li class="mb-4 ms-6">
            <div class="group flex gap-x-6">
                <div class="relative">
                    {#if shouldShowLineForInput}
                        <div class={cn(
                            "absolute left-1/2 top-0 h-[100%] -translate-x-1/2",
                            getTimelineLineWidth(true),
                            timelineLineColorClasses[entryColor]
                        )}></div>
                    {/if}
                    <span class={cn(
                        "relative z-10 flex items-center justify-center w-6 h-6 rounded-full ring-8 ring-gray-950 dark:ring-gray-950",
                        entryColorClasses[entryColor]
                    )}>
                        <MessageSquare class="w-3 h-3 text-white" />
                    </span>
                </div>
                <div class="flex-1 flex items-center gap-2">
                    <input
                        type="text"
                        bind:value={aiQuery}
                        placeholder="Ask AI a question... (Cmd/Ctrl + Enter to submit)"
                        class="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 focus:ring-0 pb-2 rainbow-border-input"
                        onkeydown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAskAI();
                            }
                        }}
                        autofocus
                        disabled={isAskingAI}
                    />
                    <button
                        class="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded transition-colors text-white flex-shrink-0"
                        onclick={handleAskAI}
                        disabled={isAskingAI || !aiQuery.trim()}
                    >
                        {#if isAskingAI}
                            <SparklesIcon class="w-3 h-3 mr-1 animate-spin" />
                            Asking...
                        {:else}
                            <MessageSquare class="w-3 h-3 mr-1" />
                            Ask AI
                        {/if}
                    </button>
                    <button
                        class="text-xs p-1.5 hover:bg-gray-800 rounded text-foreground flex-shrink-0"
                        onclick={() => {
                            isAskingAIInput = false;
                            aiQuery = '';
                        }}
                        disabled={isAskingAI}
                        title="Cancel"
                    >
                        <X class="w-3 h-3" />
                    </button>
                </div>
            </div>
        </li>
    {/if}
{:else}
    <!-- Render as <ol> wrapper (for root/parent entries) -->
    <ol class="relative" class:mb-4={childEntries.length > 0 || isAddingChild || isAskingAIInput}>
        <li class="mb-4 ms-6">
            <div class="group flex gap-x-6">
                {@render timelineBadge()}
                <div class="flex-1">
                    {@render entryContent()}
                </div>
            </div>
        </li>

        <!-- Child entries and inputs -->
        {#if childEntries.length > 0 || isAddingChild || isAskingAIInput}
            <ol class="relative">
                {#if isShowingCollapsedView && childEntries.length > 5}
                    <!-- Show hidden children count (middle entries) -->
                    {#if childEntries.length > 2}
                        <li class="ms-6 mt-2 mb-2">
                            <div class="text-xs text-muted-foreground italic text-center py-2">
                                ... {childEntries.length - 2} {childEntries.length - 2 === 1 ? 'child' : 'children'} hidden ...
                            </div>
                            {#if shouldShowViewAll}
                                <div class="text-center">
                                    <button
                                        class="text-xs text-muted-foreground hover:text-blue-400 flex items-center gap-1 mt-1 mx-auto"
                                        onclick={() => onExpandEntry?.(entry)}
                                        title="View all {childEntries.length} children"
                                    >
                                        <ExternalLink class="w-3 h-3" />
                                        View All ({childEntries.length})
                                    </button>
                                </div>
                            {/if}
                        </li>
                    {/if}
                    
                    <!-- Show last child (exactly 1 entry, regardless of type - including AI entries/responses) -->
                    <!-- Always show the true last entry in the entire thread when there are more than 5 children -->
                    <!-- Hide all children of this last entry -->
                    {#if trueLastEntryInThread}
                        <EntryNode 
                            entry={trueLastEntryInThread} 
                            isHighlighted={isHighlighted}
                            onEntryUpdate={onEntryUpdate}
                            isChild={true}
                            isRootAddingChild={isAddingChild}
                            isRootAskingAI={isAskingAIInput}
                            onRequestAddChild={(rootId) => {
                                if (rootId === entry.id) {
                                    isAddingChild = true;
                                    childContent = '';
                                } else {
                                    onRequestAddChild?.(rootId);
                                }
                            }}
                            onExpandEntry={onExpandEntry}
                            hideChildren={true}
                        />
                    {/if}
                {:else}
                    <!-- Normal view: Show all children (when 5 or fewer children) -->
                    {#each childEntries as childEntry (childEntry.id)}
                        <EntryNode 
                            entry={childEntry} 
                            isHighlighted={isHighlighted}
                            onEntryUpdate={onEntryUpdate}
                            isChild={true}
                            isRootAddingChild={isAddingChild}
                            isRootAskingAI={isAskingAIInput}
                            onRequestAddChild={(rootId) => {
                                if (rootId === entry.id) {
                                    isAddingChild = true;
                                    childContent = '';
                                } else {
                                    onRequestAddChild?.(rootId);
                                }
                            }}
                        />
                    {/each}
                {/if}
                
                <!-- Add child entry inline -->
                {#if isAddingChild}
                    <li class="mb-4 ms-6">
                        <div class="group flex gap-x-6">
                            <div class="relative">
                                {#if shouldShowLineForInput}
                                    <div class={cn(
                                        "absolute left-1/2 top-0 h-[100%] -translate-x-1/2",
                                        getTimelineLineWidth(true),
                                        timelineLineColorClasses[entryColor]
                                    )}></div>
                                {/if}
                                <span class={cn(
                                    "relative z-10 flex items-center justify-center w-6 h-6 rounded-full ring-8 ring-gray-950 dark:ring-gray-950",
                                    entryColorClasses[entryColor]
                                )}>
                                    <Plus class="w-3 h-3 text-white" />
                                </span>
                            </div>
                            <div class="flex-1 flex items-center gap-2">
                                <input
                                    type="text"
                                    bind:value={childContent}
                                    placeholder={editingChildId ? "Edit child entry... (Cmd/Ctrl + Enter to save)" : "Write your response... (Cmd/Ctrl + Enter to save)"}
                                    class="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 focus:ring-0"
                                    onkeydown={(e) => {
                                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                            handleSaveChild();
                                        }
                                    }}
                                    autofocus
                                    disabled={isSaving}
                                />
                                <button
                                    class="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded transition-colors text-white flex-shrink-0"
                                    onclick={handleSaveChild}
                                    disabled={isSaving || !childContent.trim()}
                                >
                                    {isSaving ? 'Saving...' : (editingChildId ? 'Update' : 'Save')}
                                </button>
                                <button
                                    class="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-foreground flex-shrink-0"
                                    onclick={() => {
                                        isAddingChild = false;
                                        editingChildId = null;
                                        childContent = '';
                                    }}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </li>
                {/if}
                
                <!-- Ask AI input inline -->
                {#if isAskingAIInput}
                    <li class="mb-4 ms-6">
                        <div class="group flex gap-x-6">
                            <div class="relative">
                                {#if shouldShowLineForInput}
                                    <div class={cn(
                                        "absolute left-1/2 top-0 h-[100%] -translate-x-1/2",
                                        getTimelineLineWidth(true),
                                        timelineLineColorClasses[entryColor]
                                    )}></div>
                                {/if}
                                <span class={cn(
                                    "relative z-10 flex items-center justify-center w-6 h-6 rounded-full ring-8 ring-gray-950 dark:ring-gray-950",
                                    entryColorClasses[entryColor]
                                )}>
                                    <MessageSquare class="w-3 h-3 text-white" />
                                </span>
                            </div>
                            <div class="flex-1 flex items-center gap-2">
                                <input
                                    type="text"
                                    bind:value={aiQuery}
                                    placeholder="Ask AI a question... (Cmd/Ctrl + Enter to submit)"
                                    class="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 focus:ring-0 pb-2 rainbow-border-input"
                                    onkeydown={(e) => {
                                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleAskAI();
                                        }
                                    }}
                                    autofocus
                                    disabled={isAskingAI}
                                />
                                <button
                                    class="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded transition-colors text-white flex-shrink-0"
                                    onclick={handleAskAI}
                                    disabled={isAskingAI || !aiQuery.trim()}
                                >
                                    {#if isAskingAI}
                                        <SparklesIcon class="w-3 h-3 mr-1 animate-spin" />
                                        Asking...
                                    {:else}
                                        <MessageSquare class="w-3 h-3 mr-1" />
                                        Ask AI
                                    {/if}
                                </button>
                                <button
                                    class="text-xs p-1.5 hover:bg-gray-800 rounded text-foreground flex-shrink-0"
                                    onclick={() => {
                                        isAskingAIInput = false;
                                        aiQuery = '';
                                    }}
                                    disabled={isAskingAI}
                                    title="Cancel"
                                >
                                    <X class="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </li>
                {/if}
                
                <!-- AI Loading Skeleton -->
                {#if isAskingAI || isGeneratingReflection}
                    <li class="mb-4 ms-6">
                        <div class="group flex gap-x-6">
                            <div class="relative">
                                {#if shouldShowLineForInput}
                                    <div class={cn(
                                        "absolute left-1/2 top-0 h-[150%] -translate-x-1/2",
                                        getTimelineLineWidth(true),
                                        timelineLineColorClasses[entryColor]
                                    )}></div>
                                {/if}
                                <span class={cn(
                                    "relative z-10 flex items-center justify-center w-6 h-6 rounded-full ring-8 ring-gray-950 dark:ring-gray-950",
                                    entryColorClasses[entryColor]
                                )}>
                                    <SparklesIcon class="w-3 h-3 text-white animate-pulse" />
                                </span>
                            </div>
                            <div class="flex-1">
                                <div class="space-y-2">
                                    <div class="h-4 bg-muted rounded w-3/4 animate-pulse rainbow-text"></div>
                                    <div class="h-4 bg-muted rounded w-full animate-pulse"></div>
                                    <div class="h-4 bg-muted rounded w-5/6 animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                    </li>
                {/if}
            </ol>
        {/if}
    </ol>
{/if}

<style>
    @keyframes rainbow {
        0% { color: #ffb3ba; }
        16.66% { color: #ffdfba; }
        33.33% { color: #ffffba; }
        50% { color: #baffc9; }
        66.66% { color: #bae1ff; }
        83.33% { color: #e0baff; }
        100% { color: #ffb3ba; }
    }
    
    .rainbow-text {
        animation: rainbow 6s ease-in-out infinite;
    }
    
    .rainbow-border-input {
        border-bottom: 2px solid;
        animation: rainbow 6s ease-in-out infinite;
        padding-bottom: 0.5rem;
    }
    
    .edit-menu-container {
        max-height: 0;
        opacity: 0;
        overflow: hidden;
        transition: max-height 0.3s ease-out, opacity 0.3s ease-out;
    }
    
    .group:hover .edit-menu-container {
        max-height: 100px;
        opacity: 1;
    }
    
    .edit-menu-content {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        transform: translateY(-8px);
        transition: transform 0.3s ease-out;
    }
    
    .group:hover .edit-menu-content {
        transform: translateY(0);
    }
</style>

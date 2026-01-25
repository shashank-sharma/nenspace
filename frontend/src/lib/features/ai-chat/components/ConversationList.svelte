<script lang="ts">
    import type { Conversation, ConversationFilter, ModelInfo } from '../types';
    import { ScrollArea } from '$lib/components/ui/scroll-area';
    import { Separator } from '$lib/components/ui/separator';
    import { MessageSquare } from 'lucide-svelte';
    import ConversationItem from './ConversationItem.svelte';
    import ConversationSearch from './ConversationSearch.svelte';
    import ConversationFilters from './ConversationFilters.svelte';
    import { filterConversations, groupConversationsByDate, sortConversations } from '../utils/conversation.util';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
    import EmptyState from '$lib/components/EmptyState.svelte';

    let {
        conversations = $bindable([]),
        activeConversationId = null,
        filter = $bindable<ConversationFilter>({}),
        models = [],
        isLoading = false,
        onSelect,
        onDelete,
        onToggleFavorite,
        onToggleArchive,
    } = $props<{
        conversations: Conversation[];
        activeConversationId?: string | null;
        filter?: ConversationFilter;
        models?: ModelInfo[];
        isLoading?: boolean;
        onSelect?: (id: string) => void;
        onDelete?: (id: string) => void;
        onToggleFavorite?: (id: string) => void;
        onToggleArchive?: (id: string) => void;
    }>();

    let searchQuery = $state(filter.searchQuery || '');
    let showFilters = $state(false);

    $effect(() => {
        const query = searchQuery;
        const timeoutId = setTimeout(() => {
            filter = { ...filter, searchQuery: query || undefined };
        }, 300);
        return () => clearTimeout(timeoutId);
    });

    const availableTags = $derived.by(() => {
        const tags = new Set<string>();
        conversations.forEach(conv => {
            conv.tags?.forEach(tag => tags.add(tag));
        });
        return Array.from(tags).sort();
    });

    const filteredConversations = $derived.by(() => {
        let result = filterConversations(conversations, {
            searchQuery: filter.searchQuery,
            model: filter.model,
            favorite: filter.favorite,
            archived: filter.archived,
            tags: filter.tags,
        });

        result = sortConversations(result, 'favorite', 'desc');

        return result;
    });

    const groupedConversations = $derived.by(() => {
        return groupConversationsByDate(filteredConversations);
    });
</script>

<div class="flex flex-col h-full bg-sidebar-background">
    <div class="p-4 space-y-3 border-b border-sidebar-border bg-card">
        <ConversationSearch
            bind:value={searchQuery}
            placeholder="Search conversations..."
        />

        <ConversationFilters
            bind:filter
            bind:showFilters
            {models}
            {availableTags}
        />
    </div>

    <ScrollArea class="flex-1">
        {#if isLoading}
            <div class="flex items-center justify-center py-12">
                <LoadingSpinner />
            </div>
        {:else if filteredConversations.length === 0}
            <div class="flex flex-col items-center justify-center py-12 px-4">
                <EmptyState
                    icon={MessageSquare}
                    title="No conversations found"
                    description={searchQuery || Object.keys(filter).length > 0
                        ? "Try adjusting your search or filters"
                        : "Start a new conversation to get started"}
                />
            </div>
        {:else}
            <div class="p-2 space-y-4">
                {#each groupedConversations as group}
                    <div class="space-y-1.5">
                        <div class="px-2 py-1">
                            <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {group.label}
                            </h3>
                        </div>
                        <div class="space-y-1">
                            {#each group.conversations as conv}
                                <ConversationItem
                                    conversation={conv}
                                    isActive={activeConversationId === conv.id}
                                    onClick={() => onSelect?.(conv.id)}
                                    onToggleFavorite={() => onToggleFavorite?.(conv.id)}
                                    onToggleArchive={() => onToggleArchive?.(conv.id)}
                                    onDelete={() => onDelete?.(conv.id)}
                                />
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </ScrollArea>
</div>

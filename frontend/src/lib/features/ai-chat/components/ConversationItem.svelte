<script lang="ts">
    import type { Conversation } from '../types';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import { MessageSquare, Star, Archive, Trash2, Clock } from 'lucide-svelte';
    import { cn } from '$lib/utils';
    import { formatConversationDate } from '../utils/conversation.util';

    let {
        conversation,
        isActive = false,
        onClick,
        onToggleFavorite,
        onToggleArchive,
        onDelete,
    } = $props<{
        conversation: Conversation;
        isActive?: boolean;
        onClick?: () => void;
        onToggleFavorite?: () => void;
        onToggleArchive?: () => void;
        onDelete?: () => void;
    }>();
</script>

<button
    class={cn(
        "w-full text-left p-3 rounded-lg transition-all group relative",
        "hover:bg-accent hover:text-accent-foreground",
        "border border-transparent hover:border-border",
        isActive && "bg-accent/50"
    )}
    onclick={onClick}
    aria-label={conversation.title}
>
    {#if isActive}
        <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-lg" />
    {/if}
    <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3 flex-1 min-w-0">
            <div class={cn(
                "mt-0.5 flex-shrink-0 rounded-md p-1.5",
                isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
            )}>
                <MessageSquare class="h-4 w-4" />
            </div>

            <div class="flex-1 min-w-0 space-y-1.5">
                <div class="flex items-center gap-2">
                    <span class="truncate font-medium text-sm">
                        {conversation.title}
                    </span>
                    {#if conversation.is_favorite}
                        <Star
                            class="h-3.5 w-3.5 text-yellow-500 flex-shrink-0"
                            fill="currentColor"
                        />
                    {/if}
                    {#if conversation.archived}
                        <Archive
                            class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                        />
                    {/if}
                </div>

                <div class="flex items-center gap-2 flex-wrap">
                    <Badge
                        variant="outline"
                        class="text-xs font-normal"
                    >
                        {conversation.model.split('/').pop() || conversation.model}
                    </Badge>
                    <div class="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock class="h-3 w-3" />
                        <span>{formatConversationDate(conversation.updated)}</span>
                    </div>
                </div>

                {#if conversation.tags && conversation.tags.length > 0}
                    <div class="flex flex-wrap gap-1">
                        {#each conversation.tags.slice(0, 3) as tag}
                            <Badge
                                variant="secondary"
                                class="text-xs font-normal"
                            >
                                {tag}
                            </Badge>
                        {/each}
                        {#if conversation.tags.length > 3}
                            <Badge
                                variant="secondary"
                                class="text-xs font-normal"
                            >
                                +{conversation.tags.length - 3}
                            </Badge>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>

        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {#if onToggleFavorite}
                <Button
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7"
                    onclick|stopPropagation={onToggleFavorite}
                    aria-label={conversation.is_favorite ? "Remove from favorites" : "Add to favorites"}
                >
                    <Star
                        class={cn(
                            "h-3.5 w-3.5",
                            conversation.is_favorite && "fill-current text-yellow-500"
                        )}
                    />
                </Button>
            {/if}
            {#if onToggleArchive}
                <Button
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7"
                    onclick|stopPropagation={onToggleArchive}
                    aria-label={conversation.archived ? "Unarchive" : "Archive"}
                >
                    <Archive class="h-3.5 w-3.5" />
                </Button>
            {/if}
            {#if onDelete}
                <Button
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onclick|stopPropagation={onDelete}
                    aria-label="Delete conversation"
                >
                    <Trash2 class="h-3.5 w-3.5" />
                </Button>
            {/if}
        </div>
    </div>
</button>

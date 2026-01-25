
<script lang="ts">
    import type { ConversationFilter, ModelInfo } from '../types';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import { Star, Archive, Calendar, Tag, X, Filter } from 'lucide-svelte';
    import { cn } from '$lib/utils';
    import * as Select from '$lib/components/ui/select';

    let {
        filter = $bindable<ConversationFilter>({}),
        models = [],
        availableTags = [],
        showFilters = $bindable(false),
    } = $props<{
        filter?: ConversationFilter;
        models?: ModelInfo[];
        availableTags?: string[];
        showFilters?: boolean;
    }>();

    const hasActiveFilters = $derived(
        !!filter.searchQuery ||
        !!filter.model ||
        filter.favorite !== undefined ||
        (filter.tags && filter.tags.length > 0) ||
        filter.archived !== undefined
    );

    function clearFilters() {
        filter = {};
    }

    function toggleFavorite() {
        filter = {
            ...filter,
            favorite: filter.favorite === true ? undefined : true
        };
    }

    function toggleArchived() {
        filter = {
            ...filter,
            archived: filter.archived === true ? undefined : true
        };
    }

    function toggleTag(tag: string) {
        const currentTags = filter.tags || [];
        const newTags = currentTags.includes(tag)
            ? currentTags.filter(t => t !== tag)
            : [...currentTags, tag];
        filter = { ...filter, tags: newTags.length > 0 ? newTags : undefined };
    }

    const selectedModelObj = $derived(
        filter.model ? models.find(m => m.id === filter.model) : undefined
    );
</script>

<div class="space-y-3">
    <div class="flex items-center justify-between gap-2">
        <Button
            variant="outline"
            size="sm"
            onclick={() => showFilters = !showFilters}
            class={cn("flex-1 justify-start", showFilters && "bg-accent")}
        >
            <Filter class="h-4 w-4 mr-2" />
            Filters
            {#if hasActiveFilters}
                <Badge variant="secondary" class="ml-2">
                    {Object.keys(filter).filter(k => {
                        const key = k as keyof ConversationFilter;
                        const value = filter[key];
                        if (key === 'tags') return Array.isArray(value) && value.length > 0;
                        return value !== undefined;
                    }).length}
                </Badge>
            {/if}
        </Button>
        {#if hasActiveFilters}
            <Button
                variant="ghost"
                size="sm"
                onclick={clearFilters}
                aria-label="Clear all filters"
            >
                <X class="h-4 w-4" />
            </Button>
        {/if}
    </div>

    {#if showFilters}
        <div class="space-y-3 pt-2 border-t">
            <div class="flex gap-2">
                <Button
                    variant={filter.favorite === true ? "default" : "outline"}
                    size="sm"
                    class="flex-1"
                    onclick={toggleFavorite}
                >
                    <Star
                        class="h-3.5 w-3.5 mr-1.5"
                        fill={filter.favorite === true ? "currentColor" : "none"}
                    />
                    Favorites
                </Button>
                <Button
                    variant={filter.archived === true ? "default" : "outline"}
                    size="sm"
                    class="flex-1"
                    onclick={toggleArchived}
                >
                    <Archive class="h-3.5 w-3.5 mr-1.5" />
                    Archived
                </Button>
            </div>

            {#if models.length > 0}
                <div class="space-y-2">
                    <label class="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Filter class="h-3.5 w-3.5" />
                        Model
                    </label>
                    <Select.Root
                        selected={selectedModelObj ? { value: selectedModelObj.id, label: selectedModelObj.name } : undefined}
                        onSelectedChange={(selected) => {
                            filter = {
                                ...filter,
                                model: selected?.value || undefined
                            };
                        }}
                    >
                        <Select.Trigger class="h-8 text-sm">
                            <Select.Value placeholder="All models" />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="">
                                All models
                            </Select.Item>
                            {#each models as model}
                                <Select.Item value={model.id}>
                                    {model.name}
                                </Select.Item>
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </div>
            {/if}

            {#if availableTags.length > 0}
                <div class="space-y-2">
                    <label class="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Tag class="h-3.5 w-3.5" />
                        Tags
                    </label>
                    <div class="flex flex-wrap gap-1.5">
                        {#each availableTags as tag}
                            <Button
                                variant={filter.tags?.includes(tag) ? "default" : "outline"}
                                size="sm"
                                class="h-7 text-xs"
                                onclick={() => toggleTag(tag)}
                            >
                                {tag}
                            </Button>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if hasActiveFilters}
                <div class="pt-2 border-t">
                    <div class="flex flex-wrap gap-1.5">
                        {#if filter.favorite === true}
                            <Badge variant="secondary" class="text-xs">
                                <Star class="h-3 w-3 mr-1" fill="currentColor" />
                                Favorites
                            </Badge>
                        {/if}
                        {#if filter.archived === true}
                            <Badge variant="secondary" class="text-xs">
                                <Archive class="h-3 w-3 mr-1" />
                                Archived
                            </Badge>
                        {/if}
                        {#if filter.model}
                            <Badge variant="secondary" class="text-xs">
                                Model: {filter.model.split('/').pop()}
                            </Badge>
                        {/if}
                        {#if filter.tags && filter.tags.length > 0}
                            {#each filter.tags as tag}
                                <Badge variant="secondary" class="text-xs">
                                    <Tag class="h-3 w-3 mr-1" />
                                    {tag}
                                </Badge>
                            {/each}
                        {/if}
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>

<script lang="ts">
    import { onMount } from 'svelte';
    import { Plus, X, Tag as TagIcon, Check } from 'lucide-svelte';
    import type { Tag } from '../types';
    import { MusicService } from '../services';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import * as Popover from '$lib/components/ui/popover';
    import { Input } from '$lib/components/ui/input';
    import { cn } from '$lib/utils';

    interface Props {
        selectedTagIds: string[];
        onchange: (tagIds: string[]) => void;
    }

    let { selectedTagIds = [], onchange }: Props = $props();

    let allTags = $state<Tag[]>([]);
    let searchQuery = $state('');
    let isPopoverOpen = $state(false);

    let filteredTags = $derived(
        allTags.filter(tag => 
            tag.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !selectedTagIds.includes(tag.id)
        )
    );

    let selectedTags = $derived(
        allTags.filter(tag => selectedTagIds.includes(tag.id))
    );

    async function loadTags() {
        allTags = await MusicService.getAllTags();
    }

    function toggleTag(tagId: string) {
        let nextIds: string[];
        if (selectedTagIds.includes(tagId)) {
            nextIds = selectedTagIds.filter(id => id !== tagId);
        } else {
            nextIds = [...selectedTagIds, tagId];
        }
        onchange(nextIds);
    }

    onMount(() => {
        loadTags();
    });
</script>

<div class="space-y-3">
    <div class="flex flex-wrap gap-2">
        {#each selectedTags as tag}
            <Badge 
                variant="secondary" 
                class="pl-2 pr-1 py-1 rounded-full flex items-center gap-1 group transition-all"
                style="background-color: {tag.color}20; color: {tag.color}; border-color: {tag.color}40"
            >
                <TagIcon class="h-3 w-3" />
                <span class="text-xs font-bold uppercase tracking-wider">{tag.name}</span>
                <button 
                    type="button"
                    class="ml-1 p-0.5 rounded-full hover:bg-black/10 transition-colors"
                    onclick={() => toggleTag(tag.id)}
                >
                    <X class="h-3 w-3" />
                </button>
            </Badge>
        {/each}

        <Popover.Root bind:open={isPopoverOpen}>
            <Popover.Trigger asChild let:builder>
                <Button 
                    builders={[builder]}
                    variant="outline" 
                    size="sm" 
                    class="h-7 rounded-full px-3 border-dashed border-primary/20 hover:border-primary/50 hover:bg-primary/5 text-[10px] font-black uppercase tracking-widest"
                >
                    <Plus class="h-3 w-3 mr-1" />
                    Add Tag
                </Button>
            </Popover.Trigger>
            <Popover.Content class="w-64 p-2 bg-card border-primary/10 shadow-2xl rounded-xl" align="start">
                <div class="space-y-2">
                    <div class="relative">
                        <Input 
                            placeholder="Search tags..." 
                            bind:value={searchQuery}
                            class="h-9 text-xs bg-primary/5 border-none rounded-lg focus-visible:ring-1 focus-visible:ring-primary/20"
                        />
                    </div>
                    
                    <div class="max-h-48 overflow-y-auto themed-scrollbar space-y-1">
                        {#if filteredTags.length === 0}
                            <p class="text-[10px] text-center py-4 text-muted-foreground font-medium uppercase tracking-widest">No tags found</p>
                        {:else}
                            {#each filteredTags as tag}
                                <button
                                    type="button"
                                    class="w-full flex items-center justify-between p-2 rounded-lg hover:bg-primary/5 transition-colors group text-left"
                                    onclick={() => { toggleTag(tag.id); isPopoverOpen = false; }}
                                >
                                    <div class="flex items-center gap-2">
                                        <div class="h-2 w-2 rounded-full" style="background-color: {tag.color}"></div>
                                        <span class="text-xs font-bold">{tag.name}</span>
                                    </div>
                                    {#if selectedTagIds.includes(tag.id)}
                                        <Check class="h-3 w-3 text-primary" />
                                    {/if}
                                </button>
                            {/each}
                        {/if}
                    </div>
                </div>
            </Popover.Content>
        </Popover.Root>
    </div>
</div>

<style>
    .themed-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .themed-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .themed-scrollbar::-webkit-scrollbar-thumb {
        background: hsl(var(--primary) / 0.1);
        border-radius: 10px;
    }
</style>


<script lang="ts">
    import { Search, Filter, Trash2, Download, Zap, ZapOff, Box } from 'lucide-svelte';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import type { LogFilter, LoggingProject } from '../types';
    import { LOG_LEVELS } from '../constants';
    import { Badge } from '$lib/components/ui/badge';
    import { cn } from '$lib/utils';

    let {
        filter = $bindable(),
        projects,
        isRealtime = $bindable(),
        onClear
    } = $props<{
        filter: LogFilter;
        projects: LoggingProject[];
        isRealtime: boolean;
        onClear: () => void;
    }>();

    const selectedProject = $derived(projects.find(p => p.id === filter.projectId));

    function toggleLevel(level: string) {
        if (!filter.level) filter.level = [];
        if (filter.level.includes(level as any)) {
            filter.level = filter.level.filter(l => l !== level);
        } else {
            filter.level = [...filter.level, level as any];
        }
    }
</script>

<div class="flex flex-col gap-4 p-4 bg-background border-b sticky top-0 z-20">
    <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 flex-1 max-w-2xl">
            <div class="relative flex-1">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Search logs message..."
                    class="pl-10 h-9 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/20"
                    bind:value={filter.searchQuery}
                />
            </div>

            <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild let:builder>
                    {#snippet trigger(builder)}
                        <Button builders={[builder]} variant="outline" size="sm" class="h-9 gap-2">
                            <Filter class="h-3.5 w-3.5" />
                            Levels
                            {#if filter.level?.length}
                                <Badge variant="secondary" class="ml-1 h-5 px-1.5">{filter.level.length}</Badge>
                            {/if}
                        </Button>
                    {/snippet}
                    {@render trigger(builder)}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="start" class="w-48">
                    {#each Object.entries(LOG_LEVELS) as [level, config]}
                        <DropdownMenu.CheckboxItem
                            checked={filter.level?.includes(level as any)}
                            onCheckedChange={() => toggleLevel(level)}
                        >
                            <div class="flex items-center gap-2">
                                <config.icon class={cn("h-3.5 w-3.5", config.color)} />
                                <span class="capitalize">{level}</span>
                            </div>
                        </DropdownMenu.CheckboxItem>
                    {/each}
                </DropdownMenu.Content>
            </DropdownMenu.Root>

            <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild let:builder>
                    {#snippet trigger(builder)}
                        <Button builders={[builder]} variant="outline" size="sm" class="h-9 gap-2">
                            <Box class="h-3.5 w-3.5" />
                            {selectedProject?.name || 'All Projects'}
                        </Button>
                    {/snippet}
                    {@render trigger(builder)}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="start" class="w-56">
                    <DropdownMenu.Item onSelect={() => filter.projectId = undefined}>
                        All Projects
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    {#each projects as project}
                        <DropdownMenu.Item onSelect={() => filter.projectId = project.id}>
                            {project.name}
                        </DropdownMenu.Item>
                    {/each}
                </DropdownMenu.Content>
            </DropdownMenu.Root>
        </div>

        <div class="flex items-center gap-2">
            <Button
                variant={isRealtime ? "default" : "outline"}
                size="sm"
                class={cn("h-9 gap-2 transition-all", isRealtime && "bg-blue-600 hover:bg-blue-700")}
                onclick={() => isRealtime = !isRealtime}
            >
                {#if isRealtime}
                    <Zap class="h-3.5 w-3.5 fill-current animate-pulse" />
                    Live
                {:else}
                    <ZapOff class="h-3.5 w-3.5 text-muted-foreground" />
                    Paused
                {/if}
            </Button>

            <div class="h-4 w-px bg-border mx-1"></div>

            <Button variant="ghost" size="sm" class="h-9 w-9 p-0 text-muted-foreground hover:text-foreground" onclick={onClear}>
                <Trash2 class="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" class="h-9 w-9 p-0 text-muted-foreground hover:text-foreground">
                <Download class="h-4 w-4" />
            </Button>
        </div>
    </div>
</div>


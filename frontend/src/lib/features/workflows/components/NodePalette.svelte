<script lang="ts">
    import { Input } from '$lib/components/ui/input';
    import { ScrollArea } from '$lib/components/ui/scroll-area';
    import { Search, GripVertical } from 'lucide-svelte';
    import { workflowStore } from '../stores';
    import { NODE_TYPES, NODE_COLORS } from '../constants';

    let searchQuery = $state('');
    let selectedCategory = $state<'all' | 'source' | 'processor' | 'destination'>('all');

    let filteredConnectors = $derived(workflowStore.connectors.filter(connector => {
        const matchesSearch = !searchQuery || 
            connector.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            connector.id.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesCategory = selectedCategory === 'all' || connector.type === selectedCategory;
        
        return matchesSearch && matchesCategory;
    }));

    let connectorsByType = $derived({
        source: filteredConnectors.filter(c => c.type === NODE_TYPES.SOURCE),
        processor: filteredConnectors.filter(c => c.type === NODE_TYPES.PROCESSOR),
        destination: filteredConnectors.filter(c => c.type === NODE_TYPES.DESTINATION)
    });

    function getNodeColor(type: string): string {
        return NODE_COLORS[type as keyof typeof NODE_COLORS] || NODE_COLORS.processor;
    }
</script>

<div class="node-palette flex flex-col h-full">
    <div class="px-4 pt-4 pb-3 space-y-3 border-b">
        <div class="relative">
            <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                type="text"
                placeholder="Search connectors..."
                bind:value={searchQuery}
                class="pl-8 h-9 text-sm"
            />
        </div>
        <div class="flex gap-1 flex-wrap w-full">
            <button
                class="text-xs px-2 py-1 rounded-sm font-medium transition-colors flex-shrink-0 {selectedCategory === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}"
                onclick={() => selectedCategory = 'all'}
            >
                All
            </button>
            <button
                class="text-xs px-2 py-1 rounded-sm font-medium transition-colors flex-shrink-0 {selectedCategory === 'source' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}"
                onclick={() => selectedCategory = 'source'}
            >
                Source
            </button>
            <button
                class="text-xs px-2 py-1 rounded-sm font-medium transition-colors flex-shrink-0 {selectedCategory === 'processor' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}"
                onclick={() => selectedCategory = 'processor'}
            >
                Processor
            </button>
            <button
                class="text-xs px-2 py-1 rounded-sm font-medium transition-colors flex-shrink-0 {selectedCategory === 'destination' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}"
                onclick={() => selectedCategory = 'destination'}
            >
                Destination
            </button>
        </div>
    </div>
    <ScrollArea class="flex-1">
        <div class="p-3 space-y-3">
            {#if connectorsByType.source.length > 0}
                <div>
                    <div class="text-xs font-semibold text-muted-foreground mb-2 px-1 uppercase tracking-wide">Source Nodes</div>
                    <div class="space-y-1.5">
                        {#each connectorsByType.source as connector}
                            <div
                                class="group p-2.5 rounded-lg border bg-card hover:bg-accent hover:border-accent-foreground/20 cursor-move transition-all shadow-sm hover:shadow flex items-center gap-2 border-l-4"
                                style="border-left-color: {getNodeColor(connector.type)}"
                                draggable="true"
                                role="button"
                                tabindex="0"
                                data-connector-id={connector.id}
                                data-connector-type={connector.type}
                                data-connector-name={connector.name}
                                ondragstart={(e) => {
                                    if (e.dataTransfer) {
                                        e.dataTransfer.setData('application/json', JSON.stringify({
                                            connectorId: connector.id,
                                            connectorType: connector.type,
                                            connectorName: connector.name
                                        }));
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }
                                }}
                            >
                                <GripVertical class="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground flex-shrink-0" />
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center">
                                        <span class="text-xs font-medium text-foreground">{connector.name}</span>
                                    </div>
                                    <div class="text-[10px] text-muted-foreground mt-1.5 truncate">{connector.id}</div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if connectorsByType.processor.length > 0}
                <div>
                    <div class="text-xs font-semibold text-muted-foreground mb-2 px-1 uppercase tracking-wide">Processor Nodes</div>
                    <div class="space-y-1.5">
                        {#each connectorsByType.processor as connector}
                            <div
                                class="group p-2.5 rounded-lg border bg-card hover:bg-accent hover:border-accent-foreground/20 cursor-move transition-all shadow-sm hover:shadow flex items-center gap-2 border-l-4"
                                style="border-left-color: {getNodeColor(connector.type)}"
                                draggable="true"
                                role="button"
                                tabindex="0"
                                data-connector-id={connector.id}
                                data-connector-type={connector.type}
                                data-connector-name={connector.name}
                                ondragstart={(e) => {
                                    if (e.dataTransfer) {
                                        e.dataTransfer.setData('application/json', JSON.stringify({
                                            connectorId: connector.id,
                                            connectorType: connector.type,
                                            connectorName: connector.name
                                        }));
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }
                                }}
                            >
                                <GripVertical class="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground flex-shrink-0" />
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center">
                                        <span class="text-xs font-medium text-foreground">{connector.name}</span>
                                    </div>
                                    <div class="text-[10px] text-muted-foreground mt-1.5 truncate">{connector.id}</div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if connectorsByType.destination.length > 0}
                <div>
                    <div class="text-xs font-semibold text-muted-foreground mb-2 px-1 uppercase tracking-wide">Destination Nodes</div>
                    <div class="space-y-1.5">
                        {#each connectorsByType.destination as connector}
                            <div
                                class="group p-2.5 rounded-lg border bg-card hover:bg-accent hover:border-accent-foreground/20 cursor-move transition-all shadow-sm hover:shadow flex items-center gap-2 border-l-4"
                                style="border-left-color: {getNodeColor(connector.type)}"
                                draggable="true"
                                role="button"
                                tabindex="0"
                                data-connector-id={connector.id}
                                data-connector-type={connector.type}
                                data-connector-name={connector.name}
                                ondragstart={(e) => {
                                    if (e.dataTransfer) {
                                        e.dataTransfer.setData('application/json', JSON.stringify({
                                            connectorId: connector.id,
                                            connectorType: connector.type,
                                            connectorName: connector.name
                                        }));
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }
                                }}
                            >
                                <GripVertical class="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground flex-shrink-0" />
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center">
                                        <span class="text-xs font-medium text-foreground">{connector.name}</span>
                                    </div>
                                    <div class="text-[10px] text-muted-foreground mt-1.5 truncate">{connector.id}</div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if filteredConnectors.length === 0}
                <div class="text-xs text-muted-foreground text-center py-8">
                    <div class="mb-1">No connectors found</div>
                    <div class="text-[10px] opacity-75">Try adjusting your search or filter</div>
                </div>
            {/if}
        </div>
    </ScrollArea>
</div>


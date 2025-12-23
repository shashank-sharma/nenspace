<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { Input } from '$lib/components/ui/input';
    import { ScrollArea } from '$lib/components/ui/scroll-area';
    import { Search } from 'lucide-svelte';
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

<Card.Root class="node-palette">
    <Card.Header>
        <Card.Title class="text-sm font-medium">Node Palette</Card.Title>
        <div class="relative mt-2">
            <Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                type="text"
                placeholder="Search connectors..."
                bind:value={searchQuery}
                class="pl-8"
            />
        </div>
        <div class="flex gap-1 mt-2">
            <button
                class="text-xs px-2 py-1 rounded {selectedCategory === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted'}"
                onclick={() => selectedCategory = 'all'}
            >
                All
            </button>
            <button
                class="text-xs px-2 py-1 rounded {selectedCategory === 'source' ? 'bg-primary text-primary-foreground' : 'bg-muted'}"
                onclick={() => selectedCategory = 'source'}
            >
                Source
            </button>
            <button
                class="text-xs px-2 py-1 rounded {selectedCategory === 'processor' ? 'bg-primary text-primary-foreground' : 'bg-muted'}"
                onclick={() => selectedCategory = 'processor'}
            >
                Processor
            </button>
            <button
                class="text-xs px-2 py-1 rounded {selectedCategory === 'destination' ? 'bg-primary text-primary-foreground' : 'bg-muted'}"
                onclick={() => selectedCategory = 'destination'}
            >
                Destination
            </button>
        </div>
    </Card.Header>
    <Card.Content class="p-0">
        <ScrollArea class="h-[600px]">
            <div class="p-2 space-y-4">
                {#if connectorsByType.source.length > 0}
                    <div>
                        <div class="text-xs font-medium text-muted-foreground mb-2 px-2">Source Nodes</div>
                        <div class="space-y-1">
                            {#each connectorsByType.source as connector}
                                <div
                                    class="p-2 rounded border cursor-move hover:bg-accent transition-colors"
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
                                    <div class="flex items-center gap-2">
                                        <div
                                            class="w-3 h-3 rounded-full"
                                            style="background-color: {getNodeColor(connector.type)}"
                                        ></div>
                                        <span class="text-xs font-medium">{connector.name}</span>
                                    </div>
                                    <div class="text-xs text-muted-foreground mt-1">{connector.id}</div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if connectorsByType.processor.length > 0}
                    <div>
                        <div class="text-xs font-medium text-muted-foreground mb-2 px-2">Processor Nodes</div>
                        <div class="space-y-1">
                            {#each connectorsByType.processor as connector}
                                <div
                                    class="p-2 rounded border cursor-move hover:bg-accent transition-colors"
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
                                    <div class="flex items-center gap-2">
                                        <div
                                            class="w-3 h-3 rounded-full"
                                            style="background-color: {getNodeColor(connector.type)}"
                                        ></div>
                                        <span class="text-xs font-medium">{connector.name}</span>
                                    </div>
                                    <div class="text-xs text-muted-foreground mt-1">{connector.id}</div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if connectorsByType.destination.length > 0}
                    <div>
                        <div class="text-xs font-medium text-muted-foreground mb-2 px-2">Destination Nodes</div>
                        <div class="space-y-1">
                            {#each connectorsByType.destination as connector}
                                <div
                                    class="p-2 rounded border cursor-move hover:bg-accent transition-colors"
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
                                    <div class="flex items-center gap-2">
                                        <div
                                            class="w-3 h-3 rounded-full"
                                            style="background-color: {getNodeColor(connector.type)}"
                                        ></div>
                                        <span class="text-xs font-medium">{connector.name}</span>
                                    </div>
                                    <div class="text-xs text-muted-foreground mt-1">{connector.id}</div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if filteredConnectors.length === 0}
                    <div class="text-xs text-muted-foreground text-center py-4">No connectors found</div>
                {/if}
            </div>
        </ScrollArea>
    </Card.Content>
</Card.Root>


<script lang="ts">
    import { Badge } from '$lib/components/ui/badge';
    import * as Card from '$lib/components/ui/card';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
    import type { DataSchema } from '../types';
    import { workflowEditorStore } from '../stores';

    let {
        inputSchema,
        outputSchema,
        showDiff = false
    } = $props<{
        inputSchema: DataSchema | null;
        outputSchema: DataSchema | null;
        showDiff?: boolean;
    }>();

    const getNodeLabel = (nodeId: string): string => {
        const node = workflowEditorStore.nodes.find(n => n.id === nodeId);
        return node?.data.label || nodeId.substring(0, 8);
    };

    const hasMultipleSources = $derived(
        inputSchema?.source_nodes && inputSchema.source_nodes.length > 1
    );

    const groupedFields = $derived(() => {
        if (!inputSchema) return {};

        const groups: Record<string, typeof inputSchema.fields> = {};

        for (const field of inputSchema.fields) {
            const sourceId = field.source_node || 'unknown';
            const sourceLabel = getNodeLabel(sourceId);

            if (!groups[sourceLabel]) {
                groups[sourceLabel] = [];
            }
            groups[sourceLabel].push(field);
        }

        return groups;
    });

    const diffFields = $derived(() => {
        if (!inputSchema || !outputSchema || !showDiff) return null;
        if (!inputSchema.fields || !outputSchema.fields) return null;

        const inputFieldMap = new Map(inputSchema.fields.map(f => [f.name, f]));
        const outputFieldMap = new Map(outputSchema.fields.map(f => [f.name, f]));

        const added: typeof outputSchema.fields = [];
        const removed: typeof inputSchema.fields = [];
        const modified: Array<{ input: typeof inputSchema.fields[0]; output: typeof outputSchema.fields[0] }> = [];

        for (const outputField of outputSchema.fields) {
            if (!inputFieldMap.has(outputField.name)) {
                added.push(outputField);
            } else {
                const inputField = inputFieldMap.get(outputField.name)!;
                if (inputField.type !== outputField.type) {
                    modified.push({ input: inputField, output: outputField });
                }
            }
        }

        for (const inputField of inputSchema.fields) {
            if (!outputFieldMap.has(inputField.name)) {
                removed.push(inputField);
            }
        }

        return { added, removed, modified };
    });
</script>

<Card.Root class="w-full">
    <Card.Header>
        <Card.Title class="text-sm">Schema Information</Card.Title>
        <Card.Description class="text-xs">
            {#if hasMultipleSources}
                Fields from {inputSchema?.source_nodes?.length || 0} sources
            {:else if inputSchema}
                {inputSchema.fields.length} field{inputSchema.fields.length !== 1 ? 's' : ''}
            {:else}
                No schema available
            {/if}
        </Card.Description>
    </Card.Header>
    <Card.Content>
        {#if !inputSchema}
            <p class="text-sm text-muted-foreground">No input schema available</p>
        {:else if hasMultipleSources && Object.keys(groupedFields()).length > 1}

            {@const sourceLabels = Object.keys(groupedFields())}
            {@const numSources = sourceLabels.length}
            <Tabs defaultValue={sourceLabels[0]} class="w-full">
                <TabsList class="grid w-full" style="grid-template-columns: repeat({numSources}, minmax(0, 1fr));">
                    {#each sourceLabels as sourceLabel}
                        <TabsTrigger value={sourceLabel} class="text-xs">
                            {sourceLabel}
                        </TabsTrigger>
                    {/each}
                </TabsList>
                {#each Object.entries(groupedFields()) as [sourceLabel, fields]}
                    <TabsContent value={sourceLabel} class="mt-2">
                        <div class="space-y-1">
                            {#each fields as field}
                                <div class="flex items-center justify-between p-2 rounded border text-xs">
                                    <div class="flex-1">
                                        <div class="font-medium">{field.name}</div>
                                        <div class="text-muted-foreground text-xs">
                                            {field.type} {field.nullable ? '(nullable)' : '(required)'}
                                        </div>
                                        {#if field.description}
                                            <div class="text-muted-foreground text-xs mt-0.5">
                                                {field.description}
                                            </div>
                                        {/if}
                                    </div>
                                    <Badge variant="outline" class="ml-2">
                                        {field.type}
                                    </Badge>
                                </div>
                            {/each}
                        </div>
                    </TabsContent>
                {/each}
            </Tabs>
        {:else}

            <div class="space-y-1 max-h-64 overflow-y-auto">
                {#each inputSchema.fields as field}
                    <div class="flex items-center justify-between p-2 rounded border text-xs">
                        <div class="flex-1">
                            <div class="font-medium">{field.name}</div>
                            <div class="text-muted-foreground text-xs">
                                {field.type} {field.nullable ? '(nullable)' : '(required)'}
                            </div>
                            {#if field.description}
                                <div class="text-muted-foreground text-xs mt-0.5">
                                    {field.description}
                                </div>
                            {/if}
                            {#if field.source_node && hasMultipleSources}
                                <div class="text-muted-foreground text-xs mt-0.5">
                                    from {getNodeLabel(field.source_node)}
                                </div>
                            {/if}
                        </div>
                        <Badge variant="outline" class="ml-2">
                            {field.type}
                        </Badge>
                    </div>
                {/each}
            </div>
        {/if}

        {#if showDiff && diffFields && diffFields.added !== undefined}
            <div class="mt-4 pt-4 border-t">
                <h4 class="text-sm font-medium mb-2">Schema Changes</h4>
                {#if diffFields.added && diffFields.added.length > 0}
                    <div class="mb-2">
                        <div class="text-xs text-green-600 dark:text-green-400 mb-1">Added ({diffFields.added.length})</div>
                        {#each diffFields.added as field}
                            <div class="text-xs p-1 bg-green-50 dark:bg-green-950 rounded">
                                + {field.name} ({field.type})
                            </div>
                        {/each}
                    </div>
                {/if}
                {#if diffFields.removed && diffFields.removed.length > 0}
                    <div class="mb-2">
                        <div class="text-xs text-red-600 dark:text-red-400 mb-1">Removed ({diffFields.removed.length})</div>
                        {#each diffFields.removed as field}
                            <div class="text-xs p-1 bg-red-50 dark:bg-red-950 rounded">
                                - {field.name} ({field.type})
                            </div>
                        {/each}
                    </div>
                {/if}
                {#if diffFields.modified && diffFields.modified.length > 0}
                    <div>
                        <div class="text-xs text-yellow-600 dark:text-yellow-400 mb-1">Modified ({diffFields.modified.length})</div>
                        {#each diffFields.modified as { input, output }}
                            <div class="text-xs p-1 bg-yellow-50 dark:bg-yellow-950 rounded">
                                {input.name}: {input.type} → {output.type}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    </Card.Content>
</Card.Root>


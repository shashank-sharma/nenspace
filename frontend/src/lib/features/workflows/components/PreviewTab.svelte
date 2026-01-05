<script lang="ts">
import { Button } from '$lib/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-svelte';
import { Badge } from '$lib/components/ui/badge';
import type { FlowNode } from '../types';
import { workflowEditorStore } from '../stores';
import { toast } from 'svelte-sonner';

    let {
        node,
        transformations,
        onApply
    } = $props<{
        node: FlowNode;
        transformations: Array<Record<string, any>>;
        onApply?: () => void;
    }>();

    let applied = $state(false);

    const previewData = $derived(workflowEditorStore.getNodeOutputSampleData(node.id));
    const isLoadingWorkflowData = $derived(workflowEditorStore.isLoadingWorkflowData);

    const previewError = $derived(() => {
        if (isLoadingWorkflowData) return null;
        if (transformations.length === 0) return 'No transformations to preview';
        if (!previewData) {

            const nodeError = Array.from(workflowEditorStore.loadErrors.entries())
                .find(([key]) => key.startsWith(`${node.id}_`));
            if (nodeError) {
                return `Failed to load sample data: ${nodeError[1]}`;
            }
            return 'No preview data available. Data may still be loading.';
        }
        return null;
    });

    function handleApply() {
        if (!node) return;

        const hasErrors = transformations.some(t => {
            if (!t.type) return true;

            return false;
        });

        if (hasErrors) {
            toast.error('Please fix transformation errors before applying');
            return;
        }

        applied = true;
        toast.success('Transformations applied successfully');

        if (onApply) {
            onApply();
        }
    }

    const previewFields = $derived(() => {
        if (!previewData?.data || previewData.data.length === 0) return [];

        const fields = new Set<string>();
        previewData.data.forEach(record => {
            Object.keys(record).forEach(key => fields.add(key));
        });
        return Array.from(fields).sort();
    });
</script>

<div class="space-y-4 h-full flex flex-col">

    <div class="flex items-center justify-between">
        <div>
            <h3 class="text-sm font-medium">Data Preview</h3>
            <p class="text-xs text-muted-foreground">
                Preview how your data will look after transformations
            </p>
        </div>
        {#if previewData}
            <Badge variant="secondary" class="text-xs">
                {previewData.metadata?.record_count || 0} total records
            </Badge>
        {/if}
    </div>

    {#if transformations.length === 0}
        <div class="flex-1 flex items-center justify-center border border-dashed rounded-md">
            <div class="text-center p-4">
                <p class="text-sm text-muted-foreground">No transformations to preview</p>
                <p class="text-xs text-muted-foreground mt-1">Add transformations in the previous tab</p>
            </div>
        </div>
    {:else if isLoadingWorkflowData}
        <div class="flex-1 flex items-center justify-center">
            <div class="text-center space-y-2">
                <Loader2 class="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                <p class="text-xs text-muted-foreground">Loading workflow data...</p>
                <p class="text-xs text-muted-foreground/75">
                    {workflowEditorStore.loadProgress.phase}
                </p>
            </div>
        </div>
    {:else if previewError()}
        <div class="flex-1 flex items-center justify-center border border-destructive/20 rounded-md bg-destructive/5">
            <div class="text-center p-4 space-y-2">
                <AlertCircle class="h-5 w-5 text-destructive mx-auto" />
                <p class="text-sm text-destructive">{previewError()}</p>
                {#if workflowEditorStore.loadErrors.size > 0}
                    <Button
                        variant="outline"
                        size="sm"
                        on:click={() => workflowEditorStore.retryFailedNodes()}
                        class="mt-2"
                    >
                        Retry Failed Nodes
                    </Button>
                {/if}
            </div>
        </div>
    {:else if previewData && previewData.data && previewData.data.length > 0}

        <div class="flex-1 overflow-hidden flex flex-col border rounded-md">

            <div class="sticky top-0 bg-muted/50 border-b p-2 z-10">
                <div class="flex items-center justify-between">
                    <div class="text-xs font-medium">
                        Showing {Math.min(20, previewData.data.length)} of {previewData.metadata?.record_count || previewData.data.length} records
                    </div>
                    {#if previewData.metadata?.execution_time_ms}
                        <Badge variant="outline" class="text-xs">
                            {previewData.metadata.execution_time_ms}ms
                        </Badge>
                    {/if}
                </div>
            </div>

            <div class="flex-1 overflow-auto custom-scrollbar">
                <table class="w-full text-xs border-collapse">
                    <thead class="bg-muted/30 sticky top-0 z-10">
                        <tr>
                            {#each previewFields as fieldName}
                                <th class="text-left p-2 border-b font-medium whitespace-nowrap">
                                    {fieldName}
                                </th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody>
                        {#each previewData.data.slice(0, 20) as record, recordIndex}
                            <tr class="border-b hover:bg-muted/20">
                                {#each previewFields as fieldName}
                                    <td class="p-2 text-muted-foreground">
                                        {#if record[fieldName] === null || record[fieldName] === undefined}
                                            <span class="text-muted-foreground/50">—</span>
                                        {:else if typeof record[fieldName] === 'object'}
                                            <span class="font-mono text-[10px]">
                                                {JSON.stringify(record[fieldName])}
                                            </span>
                                        {:else}
                                            <span class="truncate block max-w-[200px]" title={String(record[fieldName])}>
                                                {String(record[fieldName]).slice(0, 50)}
                                                {String(record[fieldName]).length > 50 ? '...' : ''}
                                            </span>
                                        {/if}
                                    </td>
                                {/each}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="flex items-center justify-between pt-2 border-t">
            <div class="text-xs text-muted-foreground">
                {#if applied}
                    <div class="flex items-center gap-2 text-green-600">
                        <CheckCircle2 class="h-4 w-4" />
                        <span>Transformations applied</span>
                    </div>
                {:else}
                    Review the preview above and click Apply to save transformations
                {/if}
            </div>
            <Button
                on:click={handleApply}
                disabled={applied}
                class="h-8 text-xs"
            >
                {#if applied}
                    <CheckCircle2 class="h-3 w-3 mr-1" />
                    Applied
                {:else}
                    Apply Transformations
                {/if}
            </Button>
        </div>
    {:else}
        <div class="flex-1 flex items-center justify-center border border-dashed rounded-md">
            <div class="text-center p-4">
                <p class="text-sm text-muted-foreground">No preview data available</p>
                <p class="text-xs text-muted-foreground mt-1">
                    Preview data should be loaded automatically when workflow data is preloaded.
                </p>
            </div>
        </div>
    {/if}
</div>

<style>
    .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: hsl(var(--muted-foreground) / 0.5) hsl(var(--muted) / 0.2);
    }

    .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
    }

    .custom-scrollbar::-webkit-scrollbar-track {
        background: hsl(var(--muted) / 0.12);
        border-radius: 4px;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: hsl(var(--muted-foreground) / 0.45);
        border-radius: 4px;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: hsl(var(--muted-foreground) / 0.6);
    }
</style>


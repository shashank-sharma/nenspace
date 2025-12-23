<script lang="ts">
    import { ScrollArea } from '$lib/components/ui/scroll-area';
    import { WorkflowExecutionService } from '../services/workflow-execution.service';
    import { AlertCircle, AlertTriangle, Info, Circle } from 'lucide-svelte';
    import type { ExecutionLog } from '../types';

    let { logsString = '[]' } = $props<{ logsString?: string }>();

    let logs = $derived(WorkflowExecutionService.parseLogs(logsString));

    function getLogLevelColor(level: string): string {
        switch (level.toLowerCase()) {
            case 'error':
                return 'text-red-600 dark:text-red-400';
            case 'warn':
            case 'warning':
                return 'text-yellow-600 dark:text-yellow-400';
            case 'info':
                return 'text-blue-600 dark:text-blue-400';
            default:
                return 'text-muted-foreground';
        }
    }

    function getLogLevelIcon(level: string) {
        switch (level.toLowerCase()) {
            case 'error':
                return AlertCircle;
            case 'warn':
            case 'warning':
                return AlertTriangle;
            case 'info':
                return Info;
            default:
                return Circle;
        }
    }

    function formatTimestamp(timestamp: string): string {
        try {
            const date = new Date(timestamp);
            return date.toLocaleTimeString();
        } catch {
            return timestamp;
        }
    }
</script>

<ScrollArea class="h-full">
    <div class="space-y-0.5 p-2">
        {#if logs.length === 0}
            <div class="text-xs text-muted-foreground text-center py-4">No logs available</div>
        {:else}
            {#each logs as log}
                {@const LogIcon = getLogLevelIcon(log.level)}
                <div class="text-xs py-1 px-1 flex items-start gap-2 {getLogLevelColor(log.level)}">
                    <LogIcon class="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <div class="flex-1 min-w-0">
                        <span class="text-muted-foreground text-[10px]">{formatTimestamp(log.timestamp)}</span>
                        {#if log.node_id}
                            <span class="text-muted-foreground text-[10px]"> [{log.node_id}]</span>
                        {/if}
                        <span class="ml-1">{log.message}</span>
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</ScrollArea>


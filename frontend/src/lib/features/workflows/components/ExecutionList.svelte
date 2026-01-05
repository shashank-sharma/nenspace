<script lang="ts">
    import { CheckCircle2, XCircle, Clock, AlertCircle, Timer, Hash, Copy, Loader2, AlertTriangle, Package } from 'lucide-svelte';
    import WorkflowStatusBadge from './WorkflowStatusBadge.svelte';
    import { DateUtil } from '$lib/utils/date.util';
    import { STATUS_COLORS } from '../constants';
    import { onDestroy } from 'svelte';
    import type { WorkflowExecution } from '../types';
    import { workflowExecutionStore } from '../stores';
    import { toast } from 'svelte-sonner';

    let { 
        workflowId, 
        selectedExecutionId = $bindable<string | null>(null)
    } = $props<{ 
        workflowId: string;
        selectedExecutionId?: string | null;
    }>();

    let lastWorkflowId = $state<string | null>(null);
    let isInitialized = $state(false);
    let executions = $state<WorkflowExecution[]>([]);
    let statusFilter = $state<'all' | 'running' | 'completed' | 'failed' | 'cancelled'>('all');

    const isLoading = $derived(workflowExecutionStore.isLoading(workflowId));

    const filteredExecutions = $derived(
        statusFilter === 'all' 
            ? executions 
            : executions.filter(e => e.status === statusFilter)
    );

    $effect(() => {
        if (!workflowId) {
            executions = [];
            return;
        }
        const map = workflowExecutionStore.executionsByWorkflow;
        const storeExecutions = map.get(workflowId) || [];
        executions = storeExecutions;
    });

    function formatDuration(duration: number): string {
        if (!duration || duration === 0) return 'N/A';
        if (duration < 1000) return `${duration}ms`;
        if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        if (minutes < 60) return `${minutes}m ${seconds}s`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }

    function getStatusIcon(status: string) {
        switch (status) {
            case 'running':
                return Loader2;
            case 'completed':
                return CheckCircle2;
            case 'failed':
                return XCircle;
            case 'cancelled':
                return AlertCircle;
            default:
                return AlertCircle;
        }
    }

    function getStatusBorderColor(status: string): string {
        const colors: Record<string, string> = {
            running: 'border-l-blue-500',
            completed: 'border-l-green-500',
            failed: 'border-l-red-500',
            cancelled: 'border-l-gray-500'
        };
        return colors[status] || colors.cancelled;
    }

    function getStatusBgColor(status: string): string {
        const colors: Record<string, string> = {
            running: 'bg-blue-50/50 dark:bg-blue-950/20',
            completed: 'bg-green-50/50 dark:bg-green-950/20',
            failed: 'bg-red-50/50 dark:bg-red-950/20',
            cancelled: 'bg-gray-50/50 dark:bg-gray-950/20'
        };
        return colors[status] || colors.cancelled;
    }

    function truncateId(id: string): string {
        return id.substring(0, 8);
    }

    function copyExecutionId(id: string, e: MouseEvent) {
        e.stopPropagation();
        navigator.clipboard.writeText(id).then(() => {
            toast.success('Execution ID copied');
        }).catch(() => {
            toast.error('Failed to copy ID');
        });
    }

    function getDateGroupLabel(dateString: string): string {
        if (!dateString) return 'Unknown';
        try {
            const date = new Date(dateString);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const executionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            
            if (executionDate.getTime() === today.getTime()) return 'Today';
            if (executionDate.getTime() === yesterday.getTime()) return 'Yesterday';
            
            const daysDiff = Math.floor((today.getTime() - executionDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff < 7) return 'This Week';
            if (daysDiff < 30) return 'This Month';
            
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        } catch {
            return 'Unknown';
        }
    }

    function groupExecutionsByDate(execs: WorkflowExecution[]): Map<string, WorkflowExecution[]> {
        const groups = new Map<string, WorkflowExecution[]>();
        for (const exec of execs) {
            const label = getDateGroupLabel(exec.start_time);
            if (!groups.has(label)) {
                groups.set(label, []);
            }
            groups.get(label)!.push(exec);
        }
        return groups;
    }

    const groupedExecutions = $derived(groupExecutionsByDate(filteredExecutions));

    function handleExecutionClick(execution: WorkflowExecution) {
        selectedExecutionId = execution.id;
        workflowExecutionStore.upsertExecution(execution);
        workflowExecutionStore.selectExecution(execution.id);
    }

    $effect(() => {
        if (workflowId && workflowId !== lastWorkflowId) {
            lastWorkflowId = workflowId;
            isInitialized = false;
            
            workflowExecutionStore.unsubscribeFromWorkflow(workflowId);
            
            workflowExecutionStore.fetchExecutions(workflowId).then(() => {
                workflowExecutionStore.subscribeToWorkflow(workflowId);
                isInitialized = true;
                executions = workflowExecutionStore.getExecutions(workflowId);
            });
        } else if (workflowId && !isInitialized && lastWorkflowId === workflowId) {
            isInitialized = true;
            workflowExecutionStore.fetchExecutions(workflowId).then(() => {
                workflowExecutionStore.subscribeToWorkflow(workflowId);
                executions = workflowExecutionStore.getExecutions(workflowId);
            });
        }
    });
    
    $effect(() => {
        if (!workflowId) {
            executions = [];
            return;
        }
        const map = workflowExecutionStore.executionsByWorkflow;
        const storeExecutions = map.get(workflowId) || [];
        executions = storeExecutions;
    });

    onDestroy(() => {
        if (workflowId) {
            workflowExecutionStore.unsubscribeFromWorkflow(workflowId);
        }
    });
</script>

<div class="h-full flex flex-col overflow-hidden">
    {#if executions.length > 0}
        <div class="px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0 space-y-2">
            <div class="flex items-center gap-2">
                <span class="text-sm font-medium">Executions</span>
                <span class="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{filteredExecutions.length}</span>
            </div>
            <div class="flex items-center gap-1 flex-wrap">
                <button
                    class="text-xs px-2 py-1 rounded-sm font-medium transition-colors {statusFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}"
                    onclick={() => statusFilter = 'all'}
                >
                    All
                </button>
                <button
                    class="text-xs px-2 py-1 rounded-sm font-medium transition-colors {statusFilter === 'running' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}"
                    onclick={() => statusFilter = 'running'}
                >
                    Running
                </button>
                <button
                    class="text-xs px-2 py-1 rounded-sm font-medium transition-colors {statusFilter === 'completed' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}"
                    onclick={() => statusFilter = 'completed'}
                >
                    Done
                </button>
                <button
                    class="text-xs px-2 py-1 rounded-sm font-medium transition-colors {statusFilter === 'failed' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}"
                    onclick={() => statusFilter = 'failed'}
                >
                    Failed
                </button>
            </div>
        </div>
    {/if}

    <div class="flex-1 overflow-y-auto custom-scrollbar">
        {#if isLoading}
            <div class="space-y-2 p-4">
                {#each Array(5) as _}
                    <div class="border rounded-lg p-3 animate-pulse bg-muted/30">
                        <div class="flex items-start gap-3">
                            <div class="h-4 w-4 rounded-full bg-muted flex-shrink-0 mt-0.5"></div>
                            <div class="flex-1 min-w-0 space-y-1.5">
                                <div class="h-4 w-24 rounded bg-muted"></div>
                                <div class="h-3 w-32 rounded bg-muted"></div>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {:else if filteredExecutions.length > 0}
            <div class="p-2 space-y-3">
                {#each Array.from(groupedExecutions.entries()) as [groupLabel, groupExecutions]}
                    <div class="space-y-1.5">
                        <div class="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {groupLabel}
                        </div>
                        {#each groupExecutions as execution}
                            {@const StatusIcon = getStatusIcon(execution.status)}
                            {@const isSelected = selectedExecutionId === execution.id}
                            {@const relativeTime = DateUtil.timeAgo(execution.start_time)}
                            {@const borderColor = getStatusBorderColor(execution.status)}
                            {@const bgColor = getStatusBgColor(execution.status)}
                            <div
                                class="group relative border rounded-lg p-3 cursor-pointer transition-all shadow-sm hover:shadow-md {borderColor} {isSelected ? 'bg-accent border-primary border-l-4' : 'bg-card hover:bg-muted/50'} {!isSelected && execution.status === 'running' ? 'hover:border-blue-500/30' : ''} {!isSelected && execution.status === 'completed' ? 'hover:border-green-500/30' : ''} {!isSelected && execution.status === 'failed' ? 'hover:border-red-500/30' : ''} {!isSelected && execution.status === 'cancelled' ? 'hover:border-gray-500/30' : ''}"
                                onclick={() => handleExecutionClick(execution)}
                                role="button"
                                tabindex="0"
                                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleExecutionClick(execution); } }}
                            >
                                <div class="flex items-start gap-3">
                                    <div class="flex-shrink-0 mt-0.5">
                                        {#if execution.status === 'running'}
                                            <Loader2 class="h-4 w-4 text-blue-500 animate-spin" />
                                        {:else}
                                            <StatusIcon class="h-4 w-4" style="color: {STATUS_COLORS[execution.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.cancelled}" />
                                        {/if}
                                    </div>
                                    <div class="flex-1 min-w-0 space-y-2">
                                        <div class="flex items-center justify-between gap-2">
                                            <WorkflowStatusBadge status={execution.status} size="sm" />
                                            <span class="text-xs text-muted-foreground flex items-center gap-1">
                                                <Clock class="h-3 w-3" />
                                                {relativeTime}
                                            </span>
                                        </div>
                                        
                                        <div class="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                            {#if execution.duration > 0}
                                                <div class="flex items-center gap-1">
                                                    <Timer class="h-3 w-3" />
                                                    <span>{formatDuration(execution.duration)}</span>
                                                </div>
                                            {/if}
                                        </div>

                                        {#if execution.error_message}
                                            <div class="flex items-start gap-1.5 p-2 rounded-md bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/50">
                                                <AlertTriangle class="h-3.5 w-3.5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                                <p class="text-xs text-red-700 dark:text-red-300 line-clamp-2" title={execution.error_message}>
                                                    {execution.error_message}
                                                </p>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                                
                                <!-- ID indicator at bottom right -->
                                <button
                                    class="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer group/id"
                                    onclick={(e) => copyExecutionId(execution.id, e)}
                                    title="Click to copy ID"
                                >
                                    <Hash class="h-3 w-3 flex-shrink-0" />
                                    <span class="font-mono whitespace-nowrap max-w-0 overflow-hidden group-hover/id:max-w-[200px] group-hover/id:ml-1 transition-all duration-200">
                                        {execution.id}
                                    </span>
                                </button>
                            </div>
                        {/each}
                    </div>
                {/each}
            </div>
        {:else if executions.length === 0}
            <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Package class="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p class="text-sm font-medium text-foreground mb-1">No executions yet</p>
                <p class="text-xs text-muted-foreground">Execute your workflow to see execution history here</p>
            </div>
        {:else}
            <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Package class="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p class="text-sm font-medium text-foreground mb-1">No {statusFilter === 'all' ? '' : statusFilter} executions</p>
                <p class="text-xs text-muted-foreground">Try selecting a different filter</p>
            </div>
        {/if}
    </div>
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
        border: 1px solid hsl(var(--background));
    }

    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: hsl(var(--muted-foreground) / 0.6);
    }
</style>


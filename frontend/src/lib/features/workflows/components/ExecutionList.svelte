<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { CheckCircle2, XCircle, Clock, AlertCircle, Timer } from 'lucide-svelte';
    import { WorkflowExecutionService } from '../services';
    import WorkflowStatusBadge from './WorkflowStatusBadge.svelte';
    import { onMount } from 'svelte';
    import type { WorkflowExecution } from '../types';
    import { pb } from '$lib/config/pocketbase';
    import { COLLECTIONS } from '../constants';
    import type { UnsubscribeFunc } from 'pocketbase';

    let { 
        workflowId, 
        selectedExecutionId = $bindable<string | null>(null),
        reloadTrigger = $bindable<number>(0)
    } = $props<{ 
        workflowId: string;
        selectedExecutionId?: string | null;
        reloadTrigger?: number;
    }>();

    let executions = $state<WorkflowExecution[]>([]);
    let isLoading = $state(false);
    let subscription = $state<UnsubscribeFunc | null>(null);

    function formatDate(dateString: string): string {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleString();
        } catch {
            return dateString;
        }
    }

    function formatDuration(duration: number): string {
        if (!duration || duration === 0) return 'N/A';
        if (duration < 1000) return `${duration}ms`;
        if (duration < 60000) return `${(duration / 1000).toFixed(2)}s`;
        const minutes = Math.floor(duration / 60000);
        const seconds = ((duration % 60000) / 1000).toFixed(2);
        return `${minutes}m ${seconds}s`;
    }

    function getStatusIcon(status: string) {
        switch (status) {
            case 'running':
                return Clock;
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

    function getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            running: 'text-blue-600 dark:text-blue-400',
            completed: 'text-green-600 dark:text-green-400',
            failed: 'text-red-600 dark:text-red-400',
            cancelled: 'text-gray-600 dark:text-gray-400'
        };
        return colors[status] || colors.cancelled;
    }

    async function loadExecutions() {
        isLoading = true;
        try {
            const history = await WorkflowExecutionService.getExecutionHistory(workflowId, 20);
            // Sort by start_time descending (newest first)
            executions = history.sort((a, b) => {
                const timeA = new Date(a.start_time).getTime();
                const timeB = new Date(b.start_time).getTime();
                return timeB - timeA;
            });
        } finally {
            isLoading = false;
        }
    }

    function handleExecutionClick(execution: WorkflowExecution) {
        selectedExecutionId = execution.id;
    }

    // Subscribe to all executions for this workflow using filter
    function subscribeToExecutions() {
        if (subscription) {
            subscription();
            subscription = null;
        }

        // Subscribe to all executions for this workflow
        console.log('[ExecutionList] Setting up subscription for workflowId:', workflowId);
        pb.collection(COLLECTIONS.WORKFLOW_EXECUTIONS)
            .subscribe('*', (e: any) => {
                console.log('[ExecutionList] Subscription event received:', {
                    action: e.action,
                    recordId: e.record?.id,
                    recordWorkflowId: e.record?.workflow_id,
                    expectedWorkflowId: workflowId,
                    matches: e.record?.workflow_id === workflowId,
                    record: e.record
                });
                // Only process updates for executions belonging to this workflow
                if (e.record && e.record.workflow_id === workflowId) {
                    const updatedExecution: WorkflowExecution = {
                        id: e.record.id,
                        workflow_id: e.record.workflow_id,
                        status: e.record.status,
                        start_time: e.record.start_time,
                        end_time: e.record.end_time || '',
                        duration: e.record.duration || 0,
                        logs: typeof e.record.logs === 'string' ? e.record.logs : JSON.stringify(e.record.logs || []),
                        results: typeof e.record.results === 'string' ? e.record.results : JSON.stringify(e.record.results || {}),
                        error_message: e.record.error_message,
                        result_file_ids: e.record.result_file_ids
                    };

                    if (e.action === 'create') {
                        // Add new execution at the beginning, but check if it already exists
                        const existingIndex = executions.findIndex(exec => exec.id === updatedExecution.id);
                        if (existingIndex === -1) {
                            // New execution, add at the beginning
                            executions = [updatedExecution, ...executions];
                            console.log('[ExecutionList] New execution added:', updatedExecution.id, updatedExecution.status);
                        } else {
                            // Already exists, update it
                            executions[existingIndex] = updatedExecution;
                            executions = [...executions];
                        }
                    } else if (e.action === 'update') {
                        // Update existing execution
                        const index = executions.findIndex(exec => exec.id === updatedExecution.id);
                        if (index >= 0) {
                            executions[index] = updatedExecution;
                            executions = [...executions]; // Trigger reactivity
                            console.log('[ExecutionList] Execution updated:', updatedExecution.id, updatedExecution.status);
                        } else {
                            // If not found, add it at the beginning (might be a new execution that we missed)
                            executions = [updatedExecution, ...executions];
                            console.log('[ExecutionList] Execution added (was missing):', updatedExecution.id, updatedExecution.status);
                        }
                    } else if (e.action === 'delete') {
                        // Remove deleted execution
                        executions = executions.filter(exec => exec.id !== e.record.id);
                    }
                }
            }, {
                filter: `workflow_id = "${workflowId}"`
            })
            .then((unsubscribe: UnsubscribeFunc) => {
                subscription = unsubscribe;
            })
            .catch((error) => {
                console.error('Failed to subscribe to executions:', error);
            });
    }

    let lastWorkflowId = $state<string | null>(null);
    let lastReloadTrigger = $state(0);
    
    // Reload when workflowId prop changes (but only if it actually changed)
    $effect(() => {
        if (workflowId && workflowId !== lastWorkflowId) {
            console.log('[ExecutionList] WorkflowId changed, reloading:', workflowId);
            lastWorkflowId = workflowId;
            // Unsubscribe from old subscription
            if (subscription) {
                subscription();
                subscription = null;
            }
            // Reload and resubscribe
            loadExecutions();
            subscribeToExecutions();
        }
    });
    
    // Reload when reloadTrigger changes (triggered from parent after execution)
    $effect(() => {
        if (reloadTrigger > 0 && reloadTrigger !== lastReloadTrigger) {
            console.log('[ExecutionList] Reload triggered by parent');
            lastReloadTrigger = reloadTrigger;
            loadExecutions();
        }
    });
    
    onMount(() => {
        if (workflowId) {
            lastWorkflowId = workflowId;
            loadExecutions();
            subscribeToExecutions();
        }
    });

    // Cleanup subscription on destroy
    import { onDestroy } from 'svelte';
    onDestroy(() => {
        if (subscription) {
            subscription();
            subscription = null;
        }
    });
</script>

<div class="h-full overflow-y-auto custom-scrollbar">
    {#if isLoading}
        <div class="space-y-2 p-4">
            {#each Array(5) as _}
                <div class="border border-white/20 rounded-lg p-3 animate-pulse">
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
    {:else if executions.length > 0}
        <div class="space-y-1 p-2">
            {#each executions as execution}
                {@const StatusIcon = getStatusIcon(execution.status)}
                {@const isSelected = selectedExecutionId === execution.id}
                <div
                    class="border border-white/20 rounded-lg p-2 cursor-pointer hover:bg-muted/50 transition-colors {isSelected ? 'bg-muted border-primary' : ''}"
                    onclick={() => handleExecutionClick(execution)}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleExecutionClick(execution); } }}
                >
                    <div class="flex items-start gap-2">
                        <StatusIcon class="h-3 w-3 {getStatusColor(execution.status)} flex-shrink-0 mt-0.5" />
                        <div class="flex-1 min-w-0 space-y-1">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <WorkflowStatusBadge status={execution.status} size="sm" />
                            </div>
                            <div class="text-[10px] text-muted-foreground">
                                {formatDate(execution.start_time)}
                            </div>
                            {#if execution.duration > 0}
                                <div class="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Timer class="h-2.5 w-2.5" />
                                    <span>{formatDuration(execution.duration)}</span>
                                </div>
                            {/if}
                            {#if execution.error_message}
                                <div class="text-[10px] p-1 rounded truncate" style="color: rgb(239 68 68); background-color: rgb(239 68 68 / 0.1);" title={execution.error_message}>
                                    {execution.error_message}
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <div class="text-xs text-muted-foreground text-center py-8 px-4">
            No executions yet
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
        border: 1px solid hsl(var(--background));
    }

    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: hsl(var(--muted-foreground) / 0.6);
    }
</style>


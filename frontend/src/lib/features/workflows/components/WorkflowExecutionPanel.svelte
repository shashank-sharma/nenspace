<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import { Progress } from '$lib/components/ui/progress';
    import { Play, Square, CheckCircle2, XCircle, Clock, AlertCircle, ChevronRight, Calendar, Timer, FileText, Database, Loader2, X, ChevronDown } from 'lucide-svelte';
    import { WorkflowService, WorkflowExecutionService } from '../services';
    import WorkflowStatusBadge from './WorkflowStatusBadge.svelte';
    import ExecutionLogs from './ExecutionLogs.svelte';
    import { onMount, onDestroy, untrack } from 'svelte';
    import type { WorkflowExecution } from '../types';
    import { pb } from '$lib/config/pocketbase';
    import { COLLECTIONS } from '../constants';
    import type { UnsubscribeFunc } from 'pocketbase';

    let { 
        workflowId,
        selectedExecutionId: propSelectedExecutionId = $bindable<string | null>(null),
        onExecutionCreated = $bindable<((executionId: string) => void) | undefined>(undefined)
    } = $props<{ 
        workflowId: string;
        selectedExecutionId?: string | null;
        onExecutionCreated?: (executionId: string) => void;
    }>();

    let currentExecution = $state<WorkflowExecution | null>(null);
    let isExecuting = $state(false);
    let stopPolling = $state<(() => void) | null>(null);
    let executionHistory = $state<WorkflowExecution[]>([]);
    let selectedExecutionId = $derived(propSelectedExecutionId);
    let isLoadingHistory = $state(false);
    let liveExecutionSubscription = $state<UnsubscribeFunc | null>(null);
    let liveExecutionId = $state<string | null>(null);
    let liveStatusExpanded = $state(true);
    let liveStatusClosed = $state(false);
    let isLoadingExecution = $state(false);
    let lastLoadedExecutionId = $state<string | null>(null);
    let loadingPromise: Promise<void> | null = null;
    let previousSelectedId = $state<string | null>(null);

    // Watch for selectedExecutionId changes from parent
    // Only run when propSelectedExecutionId actually changes
    $effect(() => {
        // Only track propSelectedExecutionId - nothing else
        const selectedId = propSelectedExecutionId;
        
        // Read previousSelectedId outside untrack so we can compare properly
        // But we need to be careful not to make it a dependency
        const prevId = untrack(() => previousSelectedId);
        
        console.log('[WorkflowExecutionPanel] Effect triggered, selectedId:', selectedId, 'previousSelectedId:', prevId);
        
        // Early return if the value hasn't actually changed
        if (selectedId === prevId) {
            console.log('[WorkflowExecutionPanel] Skipping - value unchanged');
            return;
        }
        
        console.log('[WorkflowExecutionPanel] Value changed, processing...');
        
        // Update previous value immediately to prevent retriggering (inside untrack)
        untrack(() => {
            previousSelectedId = selectedId;
        });
        
        // Use untrack to read all other state without making them dependencies
        const snapshot = untrack(() => ({
            currentId: currentExecution?.id,
            isLoading: isLoadingExecution,
            lastLoaded: lastLoadedExecutionId,
            hasLoadingPromise: loadingPromise !== null
        }));
        
        // If no execution is selected, clear current execution
        if (!selectedId) {
            if (snapshot.currentId) {
                untrack(() => {
                    currentExecution = null;
                    if (liveExecutionSubscription) {
                        liveExecutionSubscription();
                        liveExecutionSubscription = null;
                    }
                    if (stopPolling) {
                        stopPolling();
                    }
                    liveExecutionId = null;
                    lastLoadedExecutionId = null;
                    loadingPromise = null;
                });
            }
            return;
        }

        // If this is already the current execution, don't reload
        if (snapshot.currentId === selectedId) {
            return;
        }

        // If we're already loading this execution, don't start another load
        if (snapshot.isLoading && snapshot.lastLoaded === selectedId) {
            return;
        }

        // If there's already a loading promise for this execution, don't start another
        if (snapshot.hasLoadingPromise && snapshot.lastLoaded === selectedId) {
            return;
        }

        console.log('[WorkflowExecutionPanel] Loading execution:', selectedId);

        // Load the selected execution - update loading state (this is fine, won't retrigger effect)
        isLoadingExecution = true;
        lastLoadedExecutionId = selectedId;
        
        // Store the promise to prevent duplicate loads
        loadingPromise = WorkflowExecutionService.getExecutionStatus(selectedId)
            .then(execution => {
                console.log('[WorkflowExecutionPanel] Execution loaded:', execution?.id, 'for selected:', selectedId);
                // Only update if this is still the selected execution (prevent race conditions)
                if (execution && execution.id === selectedId) {
                    // Update currentExecution directly (untrack only prevents effect retriggering, not UI reactivity)
                    currentExecution = execution;
                    if (execution.status === 'running') {
                        untrack(() => {
                            liveExecutionId = execution.id;
                            liveStatusClosed = false;
                            liveStatusExpanded = true;
                        });
                        startPolling(execution.id);
                        subscribeToExecutionUpdates(execution.id);
                    } else {
                        // Stop any existing polling/subscription for non-running executions
                        untrack(() => {
                            if (liveExecutionSubscription) {
                                liveExecutionSubscription();
                                liveExecutionSubscription = null;
                            }
                            if (stopPolling) {
                                stopPolling();
                            }
                            liveExecutionId = null;
                        });
                    }
                } else {
                    console.warn('[WorkflowExecutionPanel] Execution ID mismatch:', execution?.id, 'expected:', selectedId);
                }
            })
            .catch(error => {
                console.error('[WorkflowExecutionPanel] Failed to load execution:', error);
                untrack(() => {
                    isLoadingExecution = false;
                    loadingPromise = null;
                });
            })
            .finally(() => {
                // Only clear loading state if we're still loading the same execution
                // Use untrack to prevent retriggering
                untrack(() => {
                    if (lastLoadedExecutionId === selectedId) {
                        isLoadingExecution = false;
                        loadingPromise = null;
                    }
                });
            });
    });

    onMount(() => {
        loadExecutionHistory();
    });

    onDestroy(() => {
        if (stopPolling) {
            stopPolling();
        }
        if (liveExecutionSubscription) {
            liveExecutionSubscription();
            liveExecutionSubscription = null;
        }
    });

    async function loadExecutionHistory() {
        isLoadingHistory = true;
        try {
            const history = await WorkflowExecutionService.getExecutionHistory(workflowId, 10);
            executionHistory = history;
            // If no execution is selected and there's a running execution, select it
            if (!propSelectedExecutionId && history.length > 0 && history[0].status === 'running') {
                currentExecution = history[0];
                propSelectedExecutionId = history[0].id;
                liveExecutionId = history[0].id;
                liveStatusClosed = false;
                liveStatusExpanded = true;
                startPolling(history[0].id);
                subscribeToExecutionUpdates(history[0].id);
            }
        } finally {
            isLoadingHistory = false;
        }
    }

    async function handleExecute() {
        if (isExecuting) return;

        isExecuting = true;
        try {
            const result = await WorkflowService.executeWorkflow(workflowId);
            if (result && result.id) {
                const execution = await WorkflowExecutionService.getExecutionStatus(result.id);
                if (execution) {
                    currentExecution = execution;
                    liveExecutionId = execution.id;
                    liveStatusClosed = false;
                    liveStatusExpanded = true;
                    propSelectedExecutionId = execution.id;
                    
                    if (execution.status === 'running') {
                        startPolling(execution.id);
                        subscribeToExecutionUpdates(execution.id);
                    }
                    // Reload history to get the new execution in the list
                    await loadExecutionHistory();
                    
                    // Notify parent that a new execution was created (to trigger ExecutionList reload)
                    if (onExecutionCreated) {
                        onExecutionCreated(execution.id);
                    }
                    
                    // Also trigger a small delay to ensure PocketBase subscription has time to propagate
                    // The subscription should handle it, but this ensures it's in the list
                    setTimeout(() => {
                        loadExecutionHistory();
                        if (onExecutionCreated) {
                            onExecutionCreated(execution.id);
                        }
                    }, 500);
                } else {
                    console.error('Failed to get execution status for id:', result.id);
                }
            } else {
                console.error('Invalid execution result:', result);
            }
        } catch (error) {
            console.error('Failed to execute workflow:', error);
        } finally {
            isExecuting = false;
        }
    }

    function subscribeToExecutionUpdates(executionId: string) {
        // Unsubscribe from any existing subscription
        if (liveExecutionSubscription) {
            liveExecutionSubscription();
            liveExecutionSubscription = null;
        }

        // Subscribe to real-time updates for this execution
        pb.collection(COLLECTIONS.WORKFLOW_EXECUTIONS)
            .subscribe(executionId, (e: any) => {
                console.log('Execution update received:', e.action, e.record);
                
                if (e.record) {
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

                    // Update current execution if it's the same one
                    // Only update if this is the currently selected execution to prevent loops
                    // Use untrack to prevent triggering the effect
                    const currentId = untrack(() => currentExecution?.id);
                    if (currentId === updatedExecution.id && 
                        propSelectedExecutionId === updatedExecution.id) {
                        untrack(() => {
                            currentExecution = updatedExecution;
                        });
                    }

                    // If execution is no longer running, unsubscribe and refresh history
                    if (updatedExecution.status !== 'running') {
                        if (liveExecutionSubscription) {
                            liveExecutionSubscription();
                            liveExecutionSubscription = null;
                        }
                        if (stopPolling) {
                            stopPolling();
                            stopPolling = null;
                        }
                        loadExecutionHistory();
                    }
                }
            })
            .then((unsubscribe: UnsubscribeFunc) => {
                liveExecutionSubscription = unsubscribe;
            })
            .catch((error) => {
                console.error('Failed to subscribe to execution updates:', error);
            });
    }

    function startPolling(executionId: string) {
        if (stopPolling) {
            stopPolling();
        }

        stopPolling = WorkflowExecutionService.pollExecutionStatus(
            executionId,
            (execution) => {
                currentExecution = execution;
                if (execution.status !== 'running') {
                    if (stopPolling) {
                        stopPolling();
                        stopPolling = null;
                    }
                    if (liveExecutionSubscription) {
                        liveExecutionSubscription();
                        liveExecutionSubscription = null;
                    }
                    loadExecutionHistory();
                }
            },
            1000
        );
    }

    function handleStop() {
        if (stopPolling) {
            stopPolling();
            stopPolling = null;
        }
    }

    let progress = $derived(currentExecution?.status === 'running' ? undefined : 100);
    let results = $derived(currentExecution ? WorkflowExecutionService.parseResults(currentExecution.results) : {});

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

    // This function is no longer needed as selection is handled by parent
    // Keeping for backward compatibility but it won't be used
</script>

<Card.Root class="h-full flex flex-col">
    <Card.Header>
        <Card.Title class="text-sm font-medium">Execution</Card.Title>
    </Card.Header>
    <Card.Content class="space-y-4 flex-1 overflow-y-auto">
        <div class="flex items-center gap-2">
            <Button
                on:click={handleExecute}
                disabled={isExecuting || (currentExecution?.status === 'running')}
                size="sm"
            >
                <Play class="h-4 w-4 mr-2" />
                Execute
            </Button>
            {#if currentExecution?.status === 'running'}
                <Button
                    variant="outline"
                    size="sm"
                    on:click={handleStop}
                >
                    <Square class="h-4 w-4 mr-2" />
                    Stop
                </Button>
            {/if}
        </div>

        {#if !currentExecution && !isLoadingExecution}
            <div class="flex flex-col items-center justify-center py-12 text-center">
                <div class="text-sm text-muted-foreground mb-2">No execution selected</div>
                <div class="text-xs text-muted-foreground">Select an execution from the left sidebar to view details</div>
            </div>
        {/if}

        {#if isLoadingExecution}
            <div class="flex flex-col items-center justify-center py-12">
                <Loader2 class="h-6 w-6 animate-spin text-muted-foreground mb-2" />
                <div class="text-xs text-muted-foreground">Loading execution...</div>
            </div>
        {/if}

        {#if currentExecution && (!liveExecutionId || currentExecution.status !== 'running' || liveStatusClosed)}
            {@const StatusIcon = getStatusIcon(currentExecution.status)}
            <div class="space-y-3 pt-0">
                <div class="text-xs font-medium">Execution Details</div>
                <div class="space-y-3">
                    <div class="flex items-center gap-2">
                        <StatusIcon class="h-4 w-4 {getStatusColor(currentExecution.status)} flex-shrink-0" />
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-muted-foreground">Status:</span>
                            <WorkflowStatusBadge status={currentExecution.status} size="sm" />
                        </div>
                    </div>
                    <div class="space-y-1.5 pl-6">
                        <div class="flex items-center gap-2">
                            <Calendar class="h-3 w-3 text-muted-foreground" />
                            <div class="flex flex-col gap-0.5">
                                <span class="text-xs text-muted-foreground">Start Time</span>
                                <span class="text-xs">{formatDate(currentExecution.start_time)}</span>
                            </div>
                        </div>
                        {#if currentExecution.end_time}
                            <div class="flex items-center gap-2">
                                <Calendar class="h-3 w-3 text-muted-foreground" />
                                <div class="flex flex-col gap-0.5">
                                    <span class="text-xs text-muted-foreground">End Time</span>
                                    <span class="text-xs">{formatDate(currentExecution.end_time)}</span>
                                </div>
                            </div>
                        {/if}
                        {#if currentExecution.duration > 0}
                            <div class="flex items-center gap-2">
                                <Timer class="h-3 w-3 text-muted-foreground" />
                                <div class="flex flex-col gap-0.5">
                                    <span class="text-xs text-muted-foreground">Duration</span>
                                    <span class="text-xs">{formatDuration(currentExecution.duration)}</span>
                                </div>
                            </div>
                        {/if}
                    </div>
                    {#if currentExecution.status === 'running'}
                        <div class="pl-6">
                            <Progress value={undefined} class="h-1" />
                        </div>
                    {/if}
                    {#if currentExecution.error_message}
                        <div class="text-xs p-2 rounded" style="color: rgb(239 68 68); background-color: rgb(239 68 68 / 0.1);">
                            {currentExecution.error_message}
                        </div>
                    {/if}
                </div>
            </div>
        {/if}

        {#if liveExecutionId && currentExecution && currentExecution.status === 'running' && !liveStatusClosed}
            <div class="border-2 border-yellow-500/50 bg-yellow-500/10 rounded-lg overflow-hidden">
                <div 
                    class="flex items-center justify-between p-3 cursor-pointer hover:bg-yellow-500/20 transition-colors"
                    onclick={() => liveStatusExpanded = !liveStatusExpanded}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); liveStatusExpanded = !liveStatusExpanded; } }}
                >
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                        <Loader2 class="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin flex-shrink-0" />
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-medium text-yellow-600 dark:text-yellow-400">Execution in Progress</span>
                                <WorkflowStatusBadge status="running" size="sm" />
                            </div>
                            <div class="text-xs text-muted-foreground mt-0.5">
                                {formatDate(currentExecution.start_time)}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            class="h-6 w-6"
                            on:click={(e) => {
                                e.stopPropagation();
                                liveStatusClosed = true;
                            }}
                            title="Close live status"
                        >
                            <X class="h-3 w-3" />
                        </Button>
                        <ChevronDown class="h-4 w-4 text-muted-foreground transition-transform {liveStatusExpanded ? 'rotate-180' : ''}" />
                    </div>
                </div>
                {#if liveStatusExpanded}
                    <div class="border-t border-yellow-500/30 p-3 space-y-3">
                        <div class="space-y-2">
                            <div class="flex items-center justify-between text-xs">
                                <span class="text-muted-foreground">Status</span>
                                <WorkflowStatusBadge status={currentExecution.status} size="sm" />
                            </div>
                            <div class="flex items-center justify-between text-xs">
                                <span class="text-muted-foreground">Start Time</span>
                                <span>{formatDate(currentExecution.start_time)}</span>
                            </div>
                            {#if currentExecution.duration > 0}
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-muted-foreground">Duration</span>
                                    <span>{formatDuration(currentExecution.duration)}</span>
                                </div>
                            {/if}
                        </div>
                        <Progress value={undefined} class="h-1" />
                        {#if currentExecution.error_message}
                            <div class="text-xs p-2 rounded" style="color: rgb(239 68 68); background-color: rgb(239 68 68 / 0.1);">
                                {currentExecution.error_message}
                            </div>
                        {/if}
                        <div class="space-y-1">
                            <div class="flex items-center gap-2 text-xs font-medium">
                                <FileText class="h-3 w-3 text-muted-foreground" />
                                <span>Live Logs</span>
                            </div>
                            <div class="h-32 border rounded bg-background">
                                <ExecutionLogs logsString={currentExecution.logs} />
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}

        {#if currentExecution && (!liveExecutionId || currentExecution.status !== 'running' || liveStatusClosed)}
            <div class="space-y-2 pt-2 border-t">
                <div class="flex items-center gap-2">
                    <FileText class="h-3 w-3 text-muted-foreground" />
                    <div class="text-xs font-medium">Logs</div>
                </div>
                <div class="h-48 border rounded">
                    <ExecutionLogs logsString={currentExecution.logs} />
                </div>
            </div>
        {/if}

        {#if currentExecution && Object.keys(results).length > 0 && (!liveExecutionId || currentExecution.status !== 'running' || liveStatusClosed)}
            <div class="space-y-2 pt-2 border-t">
                <div class="flex items-center gap-2">
                    <Database class="h-3 w-3 text-muted-foreground" />
                    <div class="text-xs font-medium">Results</div>
                </div>
                <pre class="text-xs p-2 bg-muted rounded overflow-auto max-h-32 custom-scrollbar">{JSON.stringify(results, null, 2)}</pre>
            </div>
        {/if}


    </Card.Content>
</Card.Root>

<style>
    /* Custom scrollbar for execution history */
    .custom-scrollbar {
        scrollbar-width: thin; /* Firefox */
        scrollbar-color: hsl(var(--muted-foreground) / 0.5)
            hsl(var(--muted) / 0.2); /* thumb track */
    }

    .custom-scrollbar::-webkit-scrollbar {
        width: 10px;
    }

    .custom-scrollbar::-webkit-scrollbar-track {
        background: hsl(var(--muted) / 0.12);
        border-radius: 8px;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: hsl(var(--muted-foreground) / 0.45);
        border-radius: 8px;
        border: 2px solid hsl(var(--background));
    }

    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: hsl(var(--muted-foreground) / 0.6);
    }

    .custom-scrollbar::-webkit-scrollbar-thumb:active {
        background-color: hsl(var(--foreground) / 0.6);
    }
</style>


<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Progress } from '$lib/components/ui/progress';
    import { CheckCircle2, XCircle, Clock, AlertCircle, Calendar, Timer, FileText, Database, Loader2, X, ChevronDown, ChevronUp, TrendingUp, Activity, BarChart3, Zap, Hash, Copy, Download, AlertTriangle } from 'lucide-svelte';
    import { WorkflowService, WorkflowExecutionService } from '../services';
    import WorkflowStatusBadge from './WorkflowStatusBadge.svelte';
    import ExecutionLogs from './ExecutionLogs.svelte';
    import { DateUtil } from '$lib/utils/date.util';
    import { STATUS_COLORS } from '../constants';
    import { onMount, untrack } from 'svelte';
    import type { WorkflowExecution } from '../types';
    import { workflowExecutionStore } from '../stores';
    import { toast } from 'svelte-sonner';
    import { pb } from '$lib/config/pocketbase';

    let { 
        workflowId,
        selectedExecutionId: propSelectedExecutionId = $bindable<string | null>(null),
        onExecutionCreated = $bindable<((executionId: string) => void) | undefined>(undefined)
    } = $props<{ 
        workflowId: string;
        selectedExecutionId?: string | null;
        onExecutionCreated?: (executionId: string) => void;
    }>();

    let isLoadingExecution = $state(false);
    let logsExpanded = $state(true);
    let resultsExpanded = $state(true);
    let errorExpanded = $state(true);

    const currentExecution = $derived(workflowExecutionStore.selectedExecution);
    const executions = $derived(workflowExecutionStore.getExecutions(workflowId));

    let lastSelectedId = $state<string | null>(null);

    $effect(() => {
        const selectedId = propSelectedExecutionId;
        const prevId = untrack(() => lastSelectedId);
        
        if (selectedId === prevId) {
            return;
        }
        
        untrack(() => {
            lastSelectedId = selectedId;
        });

        if (selectedId) {
            const execution = untrack(() => workflowExecutionStore.getExecution(selectedId));
            const loading = untrack(() => isLoadingExecution);
            
            if (!execution && !loading) {
                isLoadingExecution = true;
                workflowExecutionStore.ensureExecutionLoaded(selectedId)
                    .finally(() => {
                        untrack(() => {
                            isLoadingExecution = false;
                        });
                    });
            } else if (execution) {
                workflowExecutionStore.selectExecution(selectedId);
            }
        } else {
            workflowExecutionStore.selectExecution(null);
        }
    });

    onMount(() => {
        workflowExecutionStore.fetchExecutions(workflowId).then(() => {
            const executions = workflowExecutionStore.getExecutions(workflowId);
            if (!propSelectedExecutionId && executions.length > 0 && executions[0].status === 'running') {
                propSelectedExecutionId = executions[0].id;
                workflowExecutionStore.selectExecution(executions[0].id);
            }
        });
    });

    const executionStats = $derived(() => {
        const total = executions.length;
        const completed = executions.filter(e => e.status === 'completed').length;
        const failed = executions.filter(e => e.status === 'failed').length;
        
        const successRate = total > 0 ? (completed / total) * 100 : 0;
        
        const completedExecutions = executions.filter(e => e.status === 'completed' && e.duration > 0);
        const avgDuration = completedExecutions.length > 0
            ? completedExecutions.reduce((sum, e) => sum + e.duration, 0) / completedExecutions.length
            : 0;
        
        const last10Days = executions.filter(e => {
            const execDate = new Date(e.start_time);
            const tenDaysAgo = new Date();
            tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
            return execDate >= tenDaysAgo;
        });
        
        const dailyStats = Array.from({ length: 10 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (9 - i));
            date.setHours(0, 0, 0, 0);
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            
            const dayExecutions = last10Days.filter(e => {
                const execDate = new Date(e.start_time);
                return execDate >= date && execDate < nextDate;
            });
            
            const success = dayExecutions.filter(e => e.status === 'completed').length;
            const failure = dayExecutions.filter(e => e.status === 'failed').length;
            
            return {
                date: new Date(date),
                label: i === 9 ? 'Today' : i === 8 ? 'Yesterday' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                success,
                failure,
                total: dayExecutions.length
            };
        });
        
        return {
            total,
            successRate,
            avgDuration,
            last7Days: last10Days.length,
            dailyStats
        };
    });

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
        if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        if (minutes < 60) return `${minutes}m ${seconds}s`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }

    function truncateId(id: string): string {
        return id.substring(0, 8);
    }

    function copyExecutionId(id: string) {
        navigator.clipboard.writeText(id).then(() => {
            toast.success('Execution ID copied');
        }).catch(() => {
            toast.error('Failed to copy ID');
        });
    }

    function parseFileIds(fileIds: string | undefined): string[] {
        if (!fileIds) return [];
        try {
            if (fileIds.startsWith('[') || fileIds.startsWith('{')) {
                const parsed = JSON.parse(fileIds);
                return Array.isArray(parsed) ? parsed : [parsed].filter(Boolean);
            }
            return fileIds.split(',').map(id => id.trim()).filter(Boolean);
        } catch {
            return fileIds.split(',').map(id => id.trim()).filter(Boolean);
        }
    }

    function getFileDownloadUrl(fileId: string): string {
        return pb.files.getUrl({ id: fileId, collection: 'workflow_executions' }, fileId);
    }

    function isStructuredResults(data: any): boolean {
        if (!data || typeof data !== 'object') return false;
        if (Array.isArray(data)) {
            return data.length > 0 && typeof data[0] === 'object' && data[0] !== null;
        }
        return false;
    }

    function getResultCount(data: any): number {
        if (Array.isArray(data)) return data.length;
        if (typeof data === 'object' && data !== null) {
            return Object.keys(data).length;
        }
        return 0;
    }

    const parsedFileIds = $derived(currentExecution ? parseFileIds(currentExecution.result_file_ids) : []);
    const logs = $derived(currentExecution ? WorkflowExecutionService.parseLogs(currentExecution.logs) : []);

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
</script>

<div class="h-full flex flex-col">
    <div class="flex flex-row items-center justify-between pb-2 px-4 pt-4">
        <div></div>
        {#if currentExecution}
            <div class="flex items-center gap-2">
                <span class="text-xs font-mono text-muted-foreground">{truncateId(currentExecution.id)}</span>
                <button
                    class="p-1 hover:bg-muted rounded transition-colors"
                    onclick={() => copyExecutionId(currentExecution.id)}
                    title="Copy execution ID"
                >
                    <Copy class="h-3 w-3 text-muted-foreground" />
                </button>
                <Button
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6"
                    onclick={() => {
                        propSelectedExecutionId = null;
                        workflowExecutionStore.selectExecution(null);
                    }}
                    title="Close execution details"
                >
                    <X class="h-4 w-4" />
                </Button>
            </div>
        {/if}
    </div>
    <div class="space-y-4 flex-1 overflow-y-auto px-4 pb-4">
        {#if isLoadingExecution}
            <div class="flex flex-col items-center justify-center py-12">
                <Loader2 class="h-6 w-6 animate-spin text-muted-foreground mb-2" />
                <div class="text-xs text-muted-foreground">Loading execution...</div>
            </div>
        {:else if !currentExecution}
            {@const stats = executionStats()}
            <div class="space-y-6">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div class="border rounded-lg p-3 bg-card">
                        <div class="flex items-center gap-2 mb-1">
                            <Activity class="h-3.5 w-3.5 text-muted-foreground" />
                            <span class="text-xs text-muted-foreground">Total Executions</span>
                        </div>
                        <div class="text-lg font-semibold">{stats.total}</div>
                    </div>
                    <div class="border rounded-lg p-3 bg-card">
                        <div class="flex items-center gap-2 mb-1">
                            <TrendingUp class="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            <span class="text-xs text-muted-foreground">Success Rate</span>
                        </div>
                        <div class="text-lg font-semibold">{stats.total > 0 ? stats.successRate.toFixed(1) : '0'}%</div>
                    </div>
                    <div class="border rounded-lg p-3 bg-card">
                        <div class="flex items-center gap-2 mb-1">
                            <Timer class="h-3.5 w-3.5 text-muted-foreground" />
                            <span class="text-xs text-muted-foreground">Avg Duration</span>
                        </div>
                        <div class="text-lg font-semibold">{stats.avgDuration > 0 ? formatDuration(stats.avgDuration) : 'N/A'}</div>
                    </div>
                    <div class="border rounded-lg p-3 bg-card">
                        <div class="flex items-center gap-2 mb-1">
                            <Zap class="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            <span class="text-xs text-muted-foreground">Last 7 Days</span>
                        </div>
                        <div class="text-lg font-semibold">{stats.last7Days}</div>
                    </div>
                </div>

                {#if stats.dailyStats.length > 0}
                    {@const maxValue = Math.max(...stats.dailyStats.map(d => d.success + d.failure), 1)}
                    {@const barHeight = 160}
                    {@const barGap = 4}
                    <div class="border rounded-lg p-4 bg-card">
                        <div class="mb-4">
                            <h3 class="text-sm font-semibold mb-1">Past 10 Days</h3>
                            <p class="text-xs text-muted-foreground">Success vs Failure by day</p>
                        </div>
                        <div class="flex items-end gap-2 overflow-x-auto pb-2" style="height: {barHeight + 50}px; align-items: flex-end;">
                            {#each stats.dailyStats as dayStat}
                                {@const totalHeight = dayStat.success + dayStat.failure}
                                {@const successHeight = totalHeight > 0 ? (dayStat.success / maxValue) * barHeight : 0}
                                {@const failureHeight = totalHeight > 0 ? (dayStat.failure / maxValue) * barHeight : 0}
                                <div class="flex-1 flex flex-col items-center gap-1 min-w-0 flex-shrink-0 group relative" style="height: {barHeight + 50}px; max-width: 100%;">
                                    <div class="w-full flex flex-col justify-end flex-shrink-0" style="height: {barHeight}px;">
                                        {#if dayStat.total === 0}
                                            <div class="w-full h-1 bg-muted rounded-full"></div>
                                        {:else}
                                            <div class="w-full flex flex-col rounded-lg overflow-hidden">
                                                {#if dayStat.failure > 0}
                                                    <div
                                                        class="w-full bg-rose-600 dark:bg-rose-500 transition-all hover:bg-rose-700 dark:hover:bg-rose-600 rounded-t-lg"
                                                        style="height: {failureHeight}px; min-height: {failureHeight > 0 ? '4px' : '0'};"
                                                    ></div>
                                                {/if}
                                                {#if dayStat.success > 0 && dayStat.failure > 0}
                                                    <div style="height: {barGap}px;"></div>
                                                {/if}
                                                {#if dayStat.success > 0}
                                                    <div
                                                        class="w-full bg-emerald-600 dark:bg-emerald-500 transition-all hover:bg-emerald-700 dark:hover:bg-emerald-600 rounded-b-lg"
                                                        style="height: {successHeight}px; min-height: {successHeight > 0 ? '4px' : '0'};"
                                                    ></div>
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="text-xs text-muted-foreground text-center mt-2 w-full overflow-hidden text-ellipsis whitespace-nowrap px-0.5">
                                        {dayStat.label}
                                    </div>
                                    <div class="text-xs font-medium mt-1">
                                        {dayStat.total}
                                    </div>
                                    <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-md shadow-lg border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                                        <div class="font-semibold mb-1">{dayStat.label}</div>
                                        <div class="flex items-center gap-2">
                                            <div class="flex items-center gap-1">
                                                <div class="w-2 h-2 bg-emerald-600 dark:bg-emerald-500 rounded-full"></div>
                                                <span>Success: {dayStat.success}</span>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-2 mt-1">
                                            <div class="flex items-center gap-1">
                                                <div class="w-2 h-2 bg-rose-600 dark:bg-rose-500 rounded-full"></div>
                                                <span>Failure: {dayStat.failure}</span>
                                            </div>
                                        </div>
                                        <div class="mt-1 pt-1 border-t border-border">
                                            <span>Total: {dayStat.total}</span>
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if stats.total === 0}
                    <div class="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
                        <Activity class="h-12 w-12 text-muted-foreground/50 mb-3" />
                        <p class="text-sm font-medium text-foreground mb-1">No executions yet</p>
                        <p class="text-xs text-muted-foreground">Execute your workflow to see execution history and statistics here</p>
                    </div>
                {/if}
            </div>
        {/if}

        {#if currentExecution}
            {@const statusColor = STATUS_COLORS[currentExecution.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.cancelled}
            {@const startTime = new Date(currentExecution.start_time).getTime()}
            {@const endTime = currentExecution.end_time ? new Date(currentExecution.end_time).getTime() : Date.now()}
            {@const totalDuration = endTime - startTime}
            {@const currentDuration = currentExecution.status === 'running' ? Date.now() - startTime : currentExecution.duration}
            {@const progressPercent = currentExecution.status === 'running' ? Math.min((currentDuration / Math.max(totalDuration, 1)) * 100, 95) : 100}
            <div class="space-y-4">
                <div>
                    <div class="flex items-center gap-2 mb-3">
                        <Calendar class="h-4 w-4 text-muted-foreground" />
                        <h3 class="text-sm font-semibold">Timeline</h3>
                    </div>
                    <div class="flex items-start gap-6 flex-wrap">
                        <div>
                            <div class="text-xs font-medium text-muted-foreground mb-1">Start</div>
                            <div class="text-sm text-foreground">{new Date(currentExecution.start_time).toLocaleString()}</div>
                            <div class="text-xs text-muted-foreground mt-0.5">{DateUtil.timeAgo(currentExecution.start_time)}</div>
                        </div>
                        {#if currentExecution.end_time}
                            <div>
                                <div class="text-xs font-medium text-muted-foreground mb-1">End</div>
                                <div class="text-sm text-foreground">{new Date(currentExecution.end_time).toLocaleString()}</div>
                                <div class="text-xs text-muted-foreground mt-0.5">{DateUtil.timeAgo(currentExecution.end_time)}</div>
                            </div>
                        {/if}
                        <div>
                            <div class="text-xs font-medium text-muted-foreground mb-1">Duration</div>
                            <div class="text-sm text-foreground">{formatDuration(currentExecution.duration > 0 ? currentExecution.duration : currentDuration)}</div>
                        </div>
                    </div>
                </div>

                {#if currentExecution.error_message}
                    <div class="pt-4 border-t">
                        <div 
                            class="flex items-center justify-between cursor-pointer"
                            onclick={() => errorExpanded = !errorExpanded}
                            role="button"
                            tabindex="0"
                            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); errorExpanded = !errorExpanded; } }}
                        >
                            <div class="flex items-center gap-2">
                                <AlertTriangle class="h-4 w-4 text-red-600 dark:text-red-400" />
                                <h3 class="text-sm font-semibold text-red-700 dark:text-red-300">Error Details</h3>
                            </div>
                            {#if errorExpanded}
                                <ChevronUp class="h-4 w-4 text-muted-foreground" />
                            {:else}
                                <ChevronDown class="h-4 w-4 text-muted-foreground" />
                            {/if}
                        </div>
                        {#if errorExpanded}
                            <div class="mt-3 pt-3 border-t border-red-200/50 dark:border-red-800/50">
                                <p class="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">{currentExecution.error_message}</p>
                            </div>
                        {/if}
                    </div>
                {/if}

                <div class="pt-4 border-t">
                    <div 
                        class="flex items-center justify-between cursor-pointer mb-3"
                        onclick={() => logsExpanded = !logsExpanded}
                        role="button"
                        tabindex="0"
                        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); logsExpanded = !logsExpanded; } }}
                    >
                        <div class="flex items-center gap-2">
                            <FileText class="h-4 w-4 text-muted-foreground" />
                            <h3 class="text-sm font-semibold">Logs</h3>
                            {#if logs.length > 0}
                                <span class="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{logs.length}</span>
                            {/if}
                        </div>
                        {#if logsExpanded}
                            <ChevronUp class="h-4 w-4 text-muted-foreground" />
                        {:else}
                            <ChevronDown class="h-4 w-4 text-muted-foreground" />
                        {/if}
                    </div>
                    {#if logsExpanded}
                        <div class="border rounded bg-background" style="height: {currentExecution.status === 'running' ? '200px' : '300px'};">
                            <ExecutionLogs logsString={currentExecution.logs} />
                        </div>
                    {/if}
                </div>

                {#if Object.keys(results).length > 0}
                    <div class="pt-4 border-t">
                        <div 
                            class="flex items-center justify-between cursor-pointer mb-3"
                            onclick={() => resultsExpanded = !resultsExpanded}
                            role="button"
                            tabindex="0"
                            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); resultsExpanded = !resultsExpanded; } }}
                        >
                            <div class="flex items-center gap-2">
                                <Database class="h-4 w-4 text-muted-foreground" />
                                <h3 class="text-sm font-semibold">Results</h3>
                                {#if isStructuredResults(results)}
                                    <span class="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{getResultCount(results)} items</span>
                                {/if}
                            </div>
                            {#if resultsExpanded}
                                <ChevronUp class="h-4 w-4 text-muted-foreground" />
                            {:else}
                                <ChevronDown class="h-4 w-4 text-muted-foreground" />
                            {/if}
                        </div>
                        {#if resultsExpanded}
                            <div class="border rounded bg-background overflow-auto max-h-96 custom-scrollbar">
                                {#if isStructuredResults(results)}
                                    <div class="overflow-x-auto">
                                        <table class="w-full text-xs">
                                            <thead class="bg-muted/50 sticky top-0">
                                                <tr>
                                                    {#each Object.keys(results[0]) as key}
                                                        <th class="px-3 py-2 text-left font-medium text-muted-foreground border-b">{key}</th>
                                                    {/each}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {#each results as row}
                                                    <tr class="border-b hover:bg-muted/30">
                                                        {#each Object.keys(results[0]) as key}
                                                            <td class="px-3 py-2">
                                                                {#if typeof row[key] === 'object' && row[key] !== null}
                                                                    <pre class="text-xs whitespace-pre-wrap">{JSON.stringify(row[key], null, 2)}</pre>
                                                                {:else}
                                                                    {String(row[key] ?? '')}
                                                                {/if}
                                                            </td>
                                                        {/each}
                                                    </tr>
                                                {/each}
                                            </tbody>
                                        </table>
                                    </div>
                                {:else}
                                    <pre class="text-xs p-4 whitespace-pre-wrap">{JSON.stringify(results, null, 2)}</pre>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/if}

                {#if parsedFileIds.length > 0}
                    <div class="pt-4 border-t">
                        <div class="flex items-center gap-2 mb-3">
                            <Download class="h-4 w-4 text-muted-foreground" />
                            <h3 class="text-sm font-semibold">Result Files</h3>
                            <span class="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{parsedFileIds.length}</span>
                        </div>
                        <div class="space-y-2">
                            {#each parsedFileIds as fileId}
                                <a
                                    href={getFileDownloadUrl(fileId)}
                                    download
                                    class="flex items-center gap-2 p-2 border rounded hover:bg-muted transition-colors text-sm"
                                >
                                    <Download class="h-4 w-4 text-muted-foreground" />
                                    <span class="font-mono text-xs">{truncateId(fileId)}</span>
                                </a>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        {/if}


    </div>
</div>

<style>
    .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: hsl(var(--muted-foreground) / 0.5)
            hsl(var(--muted) / 0.2);
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

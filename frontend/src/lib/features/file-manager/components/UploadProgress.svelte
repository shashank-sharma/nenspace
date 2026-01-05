<script lang="ts">
    import { uploadProgressStore } from '../stores/upload-progress.store.svelte';
    import { Progress } from '$lib/components/ui/progress';
    import { Button } from '$lib/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { X, CheckCircle2, AlertCircle, Upload as UploadIcon, Loader2, Minus, Maximize2 } from 'lucide-svelte';
    import { formatFileSize } from '$lib/utils/file-validation.util';
    import { slide } from 'svelte/transition';

    const tasks = $derived(uploadProgressStore.tasks);
    const completedCount = $derived(tasks.filter(t => t.status === 'completed').length);
    const totalCount = $derived(tasks.length);
    const isAllCompleted = $derived(completedCount === totalCount && totalCount > 0);

    let isMinimized = $state(false);

    function clearCompleted() {
        uploadProgressStore.clearCompleted();
    }

    function removeAll() {
        tasks.forEach(t => uploadProgressStore.removeTask(t.id));
    }
</script>

{#if tasks.length > 0}
    <Card class="shadow-xl border-2 overflow-hidden flex flex-col pointer-events-auto bg-card/95 backdrop-blur-sm">
        <CardHeader class="p-3 border-b flex flex-row items-center justify-between space-y-0">
            <CardTitle class="text-sm font-bold flex items-center gap-2">
                <UploadIcon class="h-4 w-4 text-primary" />
                Uploads ({completedCount}/{totalCount})
            </CardTitle>
            <div class="flex items-center gap-1">
                {#if isAllCompleted}
                    <Button variant="ghost" size="icon" class="h-6 w-auto px-2 text-[10px]" onclick={clearCompleted}>
                        Clear Completed
                    </Button>
                {/if}
                <Button variant="ghost" size="icon" class="h-6 w-6" onclick={() => isMinimized = !isMinimized}>
                    {#if isMinimized}
                        <Maximize2 class="h-3 w-3" />
                    {:else}
                        <Minus class="h-3 w-3" />
                    {/if}
                </Button>
                <Button variant="ghost" size="icon" class="h-6 w-6" onclick={removeAll}>
                    <X class="h-3 w-3" />
                </Button>
            </div>
        </CardHeader>

        {#if !isMinimized}
            <div transition:slide>
                <CardContent class="p-0 max-h-64 overflow-y-auto divide-y flex flex-col-reverse">
                    {#each tasks as task (task.id)}
                        <div class="p-3 flex items-start gap-3 hover:bg-accent/50 transition-colors group">
                            <div class="mt-1 shrink-0">
                                {#if task.status === 'preparing'}
                                    <Loader2 class="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                {:else if task.status === 'uploading'}
                                    <UploadIcon class="h-3.5 w-3.5 animate-pulse text-primary" />
                                {:else if task.status === 'completed'}
                                    <CheckCircle2 class="h-3.5 w-3.5 text-green-500" />
                                {:else if task.status === 'error'}
                                    <AlertCircle class="h-3.5 w-3.5 text-destructive" />
                                {/if}
                            </div>

                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between gap-2">
                                    <p class="text-xs font-medium truncate" title={task.filename}>
                                        {task.filename}
                                    </p>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100"
                                        onclick={() => uploadProgressStore.removeTask(task.id)}
                                    >
                                        <X class="h-3 w-3" />
                                    </Button>
                                </div>

                                <div class="mt-1 space-y-1">
                                    {#if task.status === 'uploading' || task.status === 'preparing'}
                                        <Progress value={task.progress} class="h-1" />
                                        <div class="flex justify-between text-[9px] text-muted-foreground">
                                            <span>{formatFileSize(task.bytesUploaded)} / {formatFileSize(task.totalBytes)}</span>
                                            <span>{task.progress}%</span>
                                        </div>
                                    {:else if task.status === 'completed'}
                                        <p class="text-[9px] text-green-600 font-medium">Completed • {formatFileSize(task.totalBytes)}</p>
                                    {:else if task.status === 'error'}
                                        <p class="text-[9px] text-destructive truncate font-medium">
                                            {task.errorMessage || 'Failed'}
                                        </p>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}
                </CardContent>
            </div>
        {/if}
    </Card>
{/if}

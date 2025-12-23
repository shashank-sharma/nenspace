<script lang="ts">
    import * as Card from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import { Plus, Play, Trash2, Edit } from 'lucide-svelte';
    import { workflowStore } from '../stores';
    import WorkflowStatusBadge from './WorkflowStatusBadge.svelte';
    import type { Workflow } from '../types';
    import { onMount } from 'svelte';

    let { onNewWorkflow } = $props<{ onNewWorkflow?: () => void }>();

    let activeId = $state<string | null>(null);

    $effect(() => {
        if (workflowStore.selectedWorkflow) {
            activeId = workflowStore.selectedWorkflow.id;
        }
    });

    function handleNew() {
        if (onNewWorkflow) {
            onNewWorkflow();
        } else {
            workflowStore.selectedWorkflow = null;
            activeId = null;
        }
    }

    function handleSelect(workflow: Workflow) {
        workflowStore.selectWorkflow(workflow);
        activeId = workflow.id;
    }

    function handleEdit(workflow: Workflow, event: Event) {
        event.stopPropagation();
        handleSelect(workflow);
    }

    function handleDelete(workflow: Workflow, event: Event) {
        event.stopPropagation();
        if (confirm(`Are you sure you want to delete "${workflow.name}"?`)) {
            workflowStore.deleteWorkflow(workflow.id);
        }
    }

    function handleExecute(workflow: Workflow, event: Event) {
        event.stopPropagation();
    }

    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return date.toLocaleDateString();
    }
</script>

<div class="workflow-list-container">
    <div class="workflow-list-scroll">
        <div
            class="workflow-list-item new-workflow-item"
            onclick={handleNew}
            role="button"
            tabindex={0}
            onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleNew();
                }
            }}
        >
            <Plus class="h-4 w-4" />
            <span class="text-sm font-medium">New Workflow</span>
        </div>

        {#if workflowStore.isLoading}
            <div class="workflow-list-loading">
                <span class="text-xs text-muted-foreground">Loading workflows...</span>
            </div>
        {:else if workflowStore.workflows.length === 0}
            <div class="workflow-list-empty">
                <span class="text-xs text-muted-foreground">No workflows yet</span>
            </div>
        {:else}
            {#each workflowStore.workflows as workflow (workflow.id)}
                <div
                    class="workflow-list-item {activeId === workflow.id ? 'active' : ''}"
                    onclick={() => handleSelect(workflow)}
                    role="button"
                    tabindex={0}
                    onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelect(workflow);
                        }
                    }}
                >
                    <div class="workflow-list-item-content">
                        <div class="workflow-list-item-header">
                            <h3 class="workflow-list-item-title">{workflow.name}</h3>
                            <div class="workflow-list-item-actions">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="h-6 w-6 p-0"
                                    on:click={(e) => handleEdit(workflow, e)}
                                >
                                    <Edit class="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="h-6 w-6 p-0 text-destructive"
                                    on:click={(e) => handleDelete(workflow, e)}
                                >
                                    <Trash2 class="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                        {#if workflow.description}
                            <p class="workflow-list-item-description">{workflow.description}</p>
                        {/if}
                        <div class="workflow-list-item-footer">
                            <WorkflowStatusBadge status={workflow.active ? 'completed' : 'cancelled'} size="sm" />
                            <span class="workflow-list-item-date">{formatDate(workflow.updated)}</span>
                        </div>
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>

<style>
    .workflow-list-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .workflow-list-item {
        padding: 0.75rem 1rem;
        cursor: pointer;
        transition: all 0.2s;
        border-bottom: 1px solid hsl(var(--border));
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .workflow-list-item:hover {
        background: hsl(var(--accent) / 0.5);
    }

    .workflow-list-item.active {
        background: hsl(var(--primary) / 0.1);
        border-left: 3px solid hsl(var(--primary));
    }

    .new-workflow-item {
        border-bottom: 1px solid hsl(var(--border));
        font-weight: 500;
        color: hsl(var(--primary));
        margin-bottom: 0.5rem;
    }

    .new-workflow-item:hover {
        background: hsl(var(--primary) / 0.1);
    }

    .workflow-list-scroll {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .workflow-list-item-content {
        flex: 1;
        min-width: 0;
    }

    .workflow-list-item-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.25rem;
    }

    .workflow-list-item-title {
        font-size: 0.875rem;
        font-weight: 500;
        line-height: 1.4;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .workflow-list-item-actions {
        display: flex;
        gap: 0.25rem;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .workflow-list-item:hover .workflow-list-item-actions {
        opacity: 1;
    }

    .workflow-list-item-description {
        font-size: 0.75rem;
        color: hsl(var(--muted-foreground));
        line-height: 1.4;
        margin-bottom: 0.5rem;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
    }

    .workflow-list-item-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .workflow-list-item-date {
        font-size: 0.75rem;
        color: hsl(var(--muted-foreground));
    }

    .workflow-list-loading,
    .workflow-list-empty {
        padding: 2rem 1rem;
        text-align: center;
    }

    .workflow-list-scroll::-webkit-scrollbar {
        width: 6px;
    }

    .workflow-list-scroll::-webkit-scrollbar-track {
        background: transparent;
    }

    .workflow-list-scroll::-webkit-scrollbar-thumb {
        background: hsl(var(--border));
        border-radius: 3px;
    }

    .workflow-list-scroll::-webkit-scrollbar-thumb:hover {
        background: hsl(var(--muted-foreground) / 0.5);
    }
</style>


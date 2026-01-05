<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { Input } from '$lib/components/ui/input';
    import { Button } from '$lib/components/ui/button';
    import * as Card from '$lib/components/ui/card';
    import * as Dialog from '$lib/components/ui/dialog';
    import { Label } from '$lib/components/ui/label';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Search, Plus, ArrowLeft, Play, Circle, CircleDot, Code2, PlayCircle } from 'lucide-svelte';
    import WorkflowList from './WorkflowList.svelte';
    import WorkflowEditor from './WorkflowEditor.svelte';
    import NodePalette from './NodePalette.svelte';
    import NodeConfigDrawer from './NodeConfigDrawer.svelte';
    import WorkflowExecutionPanel from './WorkflowExecutionPanel.svelte';
    import WorkflowValidation from './WorkflowValidation.svelte';
    import ExecutionList from './ExecutionList.svelte';
    import { workflowStore, workflowEditorStore } from '../stores';
    import { WorkflowService } from '../services';
    import { toast } from 'svelte-sonner';
    import { pb } from '$lib/config/pocketbase';
    import { DEFAULT_TIMEOUT, DEFAULT_MAX_RETRIES, DEFAULT_RETRY_DELAY } from '../constants';

    let searchQuery = $state('');
    let showNewDialog = $state(false);
    let newWorkflowName = $state('');
    let newWorkflowDescription = $state('');
    let showExecutionPanel = $state(true);
    let activeTab = $state<'editor' | 'execution'>('editor');

    let lastSearchQuery = $state('');
    let lastSelectedWorkflowId = $state<string | null>(null);
    let validationCollapsed = $state(false);
    let selectedExecutionId = $state<string | null>(null);
    
    // Resizable splitter state
    let rightSidebarWidth = $state(400); // Default width in pixels
    let isResizing = $state(false);
    let resizeStartX = $state(0);
    let resizeStartWidth = $state(0);

    // Load sidebar width from sessionStorage on mount
    $effect(() => {
        if (typeof window !== 'undefined') {
            const savedWidth = sessionStorage.getItem('workflow-right-sidebar-width');
            if (savedWidth) {
                const width = parseInt(savedWidth, 10);
                if (!isNaN(width) && width >= 300 && width <= 800) {
                    rightSidebarWidth = width;
                }
            }
        }
    });

    $effect(() => {
        if (searchQuery !== lastSearchQuery) {
            lastSearchQuery = searchQuery;
            workflowStore.setSearchQuery(searchQuery);
        }
    });

    // Track previous URL to detect actual navigation changes
    let previousUrlWorkflowId = $state<string | null>(null);
    
    // Watch for URL changes (browser back/forward)
    $effect(() => {
        const urlWorkflowId = $page.url.searchParams.get('id');
        const currentWorkflowId = workflowStore.selectedWorkflow?.id || null;
        
        // Only react to URL changes (not initial load or when we're updating URL ourselves)
        const urlChanged = urlWorkflowId !== previousUrlWorkflowId;
        previousUrlWorkflowId = urlWorkflowId;
        
        if (!urlChanged) return;
        
        // If URL has a different workflow ID, load it
        if (urlWorkflowId && urlWorkflowId !== currentWorkflowId) {
            const workflow = workflowStore.workflows.find(w => w.id === urlWorkflowId);
            if (workflow) {
                workflowStore.selectWorkflow(workflow);
            } else if (workflowStore.workflows.length > 0) {
                // Workflows loaded but this one not found, try to fetch it
                WorkflowService.getWorkflow(urlWorkflowId).then(fetchedWorkflow => {
                    if (fetchedWorkflow) {
                        workflowStore.selectWorkflow(fetchedWorkflow);
                        workflowStore.loadWorkflows(true);
                    }
                }).catch(() => {
                    // Invalid workflow ID, remove from URL
                    const url = new URL($page.url);
                    url.searchParams.delete('id');
                    goto(url.pathname + url.search, { replaceState: true, noScroll: true });
                });
            }
        } else if (!urlWorkflowId && currentWorkflowId && urlChanged) {
            // URL was cleared (e.g., browser back button), clear selection
            // Only do this if the URL actually changed (not on initial mount)
            workflowStore.selectWorkflow(null);
        }
    });


    $effect(() => {
        const currentWorkflowId = workflowStore.selectedWorkflow?.id || null;
        if (currentWorkflowId !== lastSelectedWorkflowId) {
            lastSelectedWorkflowId = currentWorkflowId;
            if (workflowStore.selectedWorkflow) {
                workflowEditorStore.loadWorkflow(workflowStore.selectedWorkflow.id);
                workflowEditorStore.setConnectors(workflowStore.connectors);
                
                // Update URL with workflow ID (only if different from current URL)
                const urlWorkflowId = $page.url.searchParams.get('id');
                if (urlWorkflowId !== workflowStore.selectedWorkflow.id) {
                    const url = new URL($page.url);
                    url.searchParams.set('id', workflowStore.selectedWorkflow.id);
                    previousUrlWorkflowId = workflowStore.selectedWorkflow.id; // Update tracking before navigation
                    goto(url.pathname + url.search, { replaceState: true, noScroll: true });
                }
            } else {
                workflowEditorStore.reset();
                
                // Remove workflow ID from URL (only if it exists)
                const urlWorkflowId = $page.url.searchParams.get('id');
                if (urlWorkflowId) {
                    const url = new URL($page.url);
                    url.searchParams.delete('id');
                    previousUrlWorkflowId = null; // Update tracking before navigation
                    goto(url.pathname + url.search, { replaceState: true, noScroll: true });
                }
            }
        }
    });

    function handleNodeClick(nodeId: string) {
        const node = workflowEditorStore.nodes.find(n => n.id === nodeId);
        if (node) {
            workflowEditorStore.selectNode(node);
        }
    }

    onMount(async () => {
        // Initialize previous URL tracking
        previousUrlWorkflowId = $page.url.searchParams.get('id');
        
        await Promise.all([
            workflowStore.loadWorkflows(),
            workflowStore.loadConnectors()
        ]);
        
        // Check if workflow ID is in URL and load it
        const workflowId = $page.url.searchParams.get('id');
        if (workflowId) {
            const workflow = workflowStore.workflows.find(w => w.id === workflowId);
            if (workflow) {
                workflowStore.selectWorkflow(workflow);
            } else {
                // Workflow not in list, try to fetch it
                try {
                    const fetchedWorkflow = await WorkflowService.getWorkflow(workflowId);
                    if (fetchedWorkflow) {
                        workflowStore.selectWorkflow(fetchedWorkflow);
                        // Refresh workflows list to include this one
                        await workflowStore.loadWorkflows(true);
                    } else {
                        toast.error('Workflow not found');
                        // Remove invalid ID from URL
                        const url = new URL($page.url);
                        url.searchParams.delete('id');
                        previousUrlWorkflowId = null;
                        goto(url.pathname + url.search, { replaceState: true, noScroll: true });
                    }
                } catch (error) {
                    console.error('Failed to load workflow from URL:', error);
                    toast.error('Failed to load workflow');
                    // Remove invalid ID from URL
                    const url = new URL($page.url);
                    url.searchParams.delete('id');
                    previousUrlWorkflowId = null;
                    goto(url.pathname + url.search, { replaceState: true, noScroll: true });
                }
            }
        }
    });

    async function handleCreateWorkflow() {
        if (!newWorkflowName.trim()) {
            toast.error('Workflow name is required');
            return;
        }

        const user = pb.authStore.model?.id;
        if (!user) {
            toast.error('User not authenticated');
            return;
        }

        const workflow = await workflowStore.createWorkflow({
            name: newWorkflowName.trim(),
            description: newWorkflowDescription.trim(),
            active: true,
            user,
            config: {},
            timeout: DEFAULT_TIMEOUT,
            max_retries: DEFAULT_MAX_RETRIES,
            retry_delay: DEFAULT_RETRY_DELAY
        });

        if (workflow) {
            showNewDialog = false;
            newWorkflowName = '';
            newWorkflowDescription = '';
            toast.success('Workflow created successfully');
            workflowStore.selectWorkflow(workflow);
        } else {
            toast.error('Failed to create workflow');
        }
    }

    function handleSearchInput(e: Event) {
        const target = e.target as HTMLInputElement;
        searchQuery = target.value;
    }

    async function handleValidate() {
        if (!workflowStore.selectedWorkflow) return;
        const result = await workflowEditorStore.validate();
        if (result.valid) {
            toast.success('Workflow validation passed');
        } else {
            toast.error(`Validation failed: ${result.errors.length} error(s)`);
        }
    }

    let isExecuting = $state(false);

    async function handleExecute() {
        if (!workflowStore.selectedWorkflow || isExecuting) return;
        
        isExecuting = true;
        try {
            const result = await WorkflowService.executeWorkflow(workflowStore.selectedWorkflow.id);
            if (result && result.id) {
                toast.success('Workflow execution started');
            } else {
                toast.error('Failed to start workflow execution');
            }
        } catch (error) {
            console.error('Execution failed:', error);
            toast.error('Failed to execute workflow');
        } finally {
            isExecuting = false;
        }
    }

    function handleResizeStart(e: MouseEvent) {
        isResizing = true;
        resizeStartX = e.clientX;
        resizeStartWidth = rightSidebarWidth;
        e.preventDefault();
    }

    function handleResizeMove(e: MouseEvent) {
        if (!isResizing) return;
        const deltaX = resizeStartX - e.clientX; // Invert because we're resizing from right
        const newWidth = Math.max(300, Math.min(800, resizeStartWidth + deltaX));
        rightSidebarWidth = newWidth;
    }

    function handleResizeEnd() {
        isResizing = false;
        // Save width to sessionStorage (persists during session, clears on browser close)
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('workflow-right-sidebar-width', rightSidebarWidth.toString());
        }
    }

    $effect(() => {
        if (isResizing) {
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
            return () => {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', handleResizeMove);
                document.removeEventListener('mouseup', handleResizeEnd);
            };
        }
    });
</script>

<div class="workflow-floating-layout">
    <div class="workflow-top-card">
        <div class="flex items-center gap-3">
            <div class="relative flex-1 max-w-md">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Search workflows..."
                    value={searchQuery}
                    oninput={handleSearchInput}
                    class="pl-10"
                />
            </div>
            <Button
                size="sm"
                onclick={() => showNewDialog = true}
                class="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm hover:shadow"
            >
                <Plus class="h-4 w-4 mr-2" />
                New Workflow
            </Button>
        </div>
    </div>

    <div class="workflow-content-area grid gap-4 flex-1 min-h-0 overflow-hidden relative" style="grid-template-columns: {workflowStore.selectedWorkflow ? `320px 1fr 4px ${rightSidebarWidth}px` : '320px 1fr'};">
        {#if !workflowStore.selectedWorkflow}
            <Card.Root class="min-w-0 h-full min-h-0 overflow-hidden flex flex-col" style="grid-column: 1;">
                <Card.Header>
                    <div class="flex items-center justify-between">
                        <Card.Title class="text-sm font-semibold">Workflows</Card.Title>
                        <span class="text-xs text-muted-foreground">{workflowStore.workflows.length}</span>
                    </div>
                </Card.Header>
                <Card.Content class="p-0">
                    <WorkflowList onNewWorkflow={() => showNewDialog = true} />
                </Card.Content>
            </Card.Root>
        {:else}
            <Card.Root class="min-w-0 h-full min-h-0 overflow-hidden flex flex-col" style="grid-column: 1;">
                <Card.Header>
                    <div class="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            class="h-8 w-8 hover:bg-accent transition-colors"
                            onclick={() => workflowStore.selectWorkflow(null)}
                            title="Back to workflows"
                        >
                            <ArrowLeft class="h-4 w-4" />
                        </Button>
                        <Card.Title class="text-sm font-semibold">
                            {activeTab === 'editor' ? 'Node Palette' : 'Executions'}
                        </Card.Title>
                    </div>
                </Card.Header>
                <Card.Content class="p-0 flex-1 min-h-0 overflow-hidden flex flex-col">
                    {#if activeTab === 'editor'}
                        <NodePalette />
                    {:else}
                        <ExecutionList 
                            workflowId={workflowStore.selectedWorkflow.id} 
                            bind:selectedExecutionId={selectedExecutionId}
                        />
                    {/if}
                </Card.Content>
            </Card.Root>
        {/if}

        <Card.Root class="min-w-0 h-full min-h-0 overflow-hidden flex flex-col" style="grid-column: {!workflowStore.selectedWorkflow ? '2 / -1' : '2'};">
            {#if workflowStore.selectedWorkflow}
                <Card.Header>
                    <div class="flex items-center justify-between">
                        <div class="flex-1 flex items-center gap-2">
                            {#if workflowStore.selectedWorkflow.active}
                                <CircleDot class="h-5 w-5 text-green-500 flex-shrink-0" title="Active" />
                            {:else}
                                <Circle class="h-5 w-5 text-muted-foreground flex-shrink-0" title="Inactive" />
                            {/if}
                            <div class="flex-1 min-w-0">
                                <Card.Title class="text-lg font-semibold">{workflowStore.selectedWorkflow.name}</Card.Title>
                                {#if workflowStore.selectedWorkflow.description}
                                    <Card.Description class="text-sm mt-1">{workflowStore.selectedWorkflow.description}</Card.Description>
                                {/if}
                            </div>
                        </div>
                        <Button
                            size="sm"
                            onclick={handleExecute}
                            disabled={isExecuting || !workflowStore.selectedWorkflow.active}
                            class="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white transition-colors shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Execute workflow"
                        >
                            <Play class="h-4 w-4 mr-2" />
                            {isExecuting ? 'Executing...' : 'Execute'}
                        </Button>
                    </div>
                </Card.Header>
                <Card.Content class="p-0 flex flex-col h-full">
                    <div class="flex gap-0.5 px-4 pt-3 pb-0 border-b bg-muted/30">
                        <button
                            class="relative px-5 py-2.5 rounded-t-md cursor-pointer transition-all text-sm font-medium mb-[-1px] flex items-center gap-2 group {activeTab === 'editor' ? 'text-primary bg-background border-t border-l border-r border-b-0 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_4px_rgba(0,0,0,0.2)]' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}"
                            onclick={() => activeTab = 'editor'}
                        >
                            <Code2 class="h-4 w-4 transition-colors {activeTab === 'editor' ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}" />
                            <span>Editor</span>
                            {#if activeTab === 'editor'}
                                <div class="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full"></div>
                            {/if}
                        </button>
                        <button
                            class="relative px-5 py-2.5 rounded-t-md cursor-pointer transition-all text-sm font-medium mb-[-1px] flex items-center gap-2 group {activeTab === 'execution' ? 'text-primary bg-background border-t border-l border-r border-b-0 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_4px_rgba(0,0,0,0.2)]' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}"
                            onclick={() => activeTab = 'execution'}
                        >
                            <PlayCircle class="h-4 w-4 transition-colors {activeTab === 'execution' ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}" />
                            <span>Execution</span>
                            {#if activeTab === 'execution'}
                                <div class="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full"></div>
                            {/if}
                        </button>
                    </div>
                    <div class="flex-1 min-h-0 overflow-hidden flex flex-col h-full">
                        <div class="h-full w-full {activeTab !== 'editor' ? 'hidden' : ''}">
                            <WorkflowEditor active={activeTab === 'editor'} />
                        </div>
                        {#if activeTab === 'execution'}
                            <div class="h-full w-full">
                                <WorkflowExecutionPanel 
                                    workflowId={workflowStore.selectedWorkflow.id}
                                    bind:selectedExecutionId={selectedExecutionId}
                                    onExecutionCreated={(executionId) => {
                                        // Subscription will handle the new execution automatically
                                    }}
                                />
                            </div>
                        {/if}
                    </div>
                </Card.Content>
            {:else}
                <Card.Content class="flex items-center justify-center h-full min-h-0 flex-1">
                    <div class="text-center">
                        <h2 class="text-xl font-semibold mb-2">No workflow selected</h2>
                        <p class="text-muted-foreground mb-4">Select a workflow from the list or create a new one</p>
                        <Button onclick={() => showNewDialog = true}>
                            <Plus class="h-4 w-4 mr-2" />
                            Create New Workflow
                        </Button>
                    </div>
                </Card.Content>
            {/if}
        </Card.Root>

        {#if workflowStore.selectedWorkflow}
            <div class="w-1 bg-border cursor-col-resize relative z-10 transition-colors hover:bg-primary active:bg-primary select-none flex-shrink-0 h-full" onmousedown={handleResizeStart} role="separator" aria-label="Resize sidebar" tabindex="0"></div>
            <div class="flex flex-col gap-2 h-full min-w-0 flex-shrink-0 overflow-hidden" style="min-width: 300px; max-width: 800px;">
                {#if workflowEditorStore.isLoadingWorkflowData}
                    <Card.Root class="flex-shrink-0">
                        <Card.Content class="flex items-center justify-center p-4">
                            <p class="text-xs text-muted-foreground">Loading validation...</p>
                        </Card.Content>
                    </Card.Root>
                {:else if workflowEditorStore.validationResult}
                    <div class="flex-shrink-0">
                        <WorkflowValidation 
                            validationResult={workflowEditorStore.validationResult} 
                            bind:collapsed={validationCollapsed}
                        />
                    </div>
                {/if}
                <Card.Root class="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col h-full">
                    <Card.Content class="flex flex-col h-full overflow-y-auto p-1 h-full custom-scrollbar">
                        <div class="flex items-center justify-center h-full w-full">
                            <div class="text-xs text-muted-foreground text-center px-4">
                                <p class="mb-2">Node configuration</p>
                                <p class="text-[10px] opacity-75">Click on a node to configure it in the drawer</p>
                            </div>
                        </div>
                    </Card.Content>
                </Card.Root>
            </div>
        {/if}
    </div>

    {#if workflowEditorStore.isDirty || workflowEditorStore.error}
        <Card.Root class="flex-shrink-0 z-10">
            <Card.Content class="py-2">
                <div class="flex items-center gap-3 text-xs">
                    {#if workflowEditorStore.error}
                        <div class="text-destructive">
                            {workflowEditorStore.error}
                        </div>
                    {/if}
                    {#if workflowEditorStore.isDirty}
                        <div class="text-muted-foreground">Unsaved changes</div>
                    {/if}
                </div>
            </Card.Content>
        </Card.Root>
    {/if}
</div>

<Dialog.Root bind:open={showNewDialog}>
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>Create New Workflow</Dialog.Title>
            <Dialog.Description>Create a new workflow to automate your tasks</Dialog.Description>
        </Dialog.Header>
        <div class="space-y-4">
            <div class="space-y-2">
                <Label for="name">Name</Label>
                <Input
                    id="name"
                    bind:value={newWorkflowName}
                    placeholder="My Workflow"
                />
            </div>
            <div class="space-y-2">
                <Label for="description">Description</Label>
                <Textarea
                    id="description"
                    bind:value={newWorkflowDescription}
                    placeholder="Workflow description..."
                />
            </div>
        </div>
        <Dialog.Footer>
            <Button variant="outline" onclick={() => showNewDialog = false} class="hover:bg-accent transition-colors">Cancel</Button>
            <Button onclick={handleCreateWorkflow} class="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm hover:shadow">Create</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<NodeConfigDrawer />

<style>
    .workflow-floating-layout {
        display: flex;
        flex-direction: column;
        height: 100%;
        gap: 1rem;
        padding: 1rem;
        overflow: hidden;
    }

    .workflow-top-card {
        flex-shrink: 0;
        z-index: 10;
    }

    /* Custom scrollbar for right sidebar */
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

    /* Global styles for nested components - using class selectors that match Tailwind classes */
    .workflow-content-area :global(.card-content) {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
    }

    .workflow-content-area :global(.workflow-editor) {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .workflow-content-area :global(.workflow-editor .card-content) {
        flex: 1;
        min-height: 0;
        height: 100%;
    }

    .workflow-content-area :global(.config-panel) {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }


    @media (max-width: 1400px) {
        .workflow-content-area {
            grid-template-columns: 280px 1fr 320px;
        }
    }

    @media (max-width: 1024px) {
        .workflow-content-area {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr auto;
        }
    }
</style>


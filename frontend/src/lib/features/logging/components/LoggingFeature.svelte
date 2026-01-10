<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { LoggingService } from '../services/logging.service';
    import type { Log, LoggingProject, LogFilter, LoggingProjectFormData } from '../types';
    import { SEARCH_DEBOUNCE_MS, REALTIME_MAX_LOGS } from '../constants';
    import { useDebouncedFilter } from '$lib/hooks/useDebouncedFilter.svelte';
    import { withErrorHandling } from '$lib/utils/error-handler.util';
    import LogHeader from './LogHeader.svelte';
    import LogFilters from './LogFilters.svelte';
    import LogList from './LogList.svelte';
    import LoadingSpinner from '$lib/components/LoadingSpinner.svelte';
    import { animate, stagger } from 'animejs';
    import * as Tabs from "$lib/components/ui/tabs";
    import { Button } from "$lib/components/ui/button";
    import { Plus, List, LayoutGrid } from "lucide-svelte";
    import LoggingProjectCard from './LoggingProjectCard.svelte';
    import LoggingProjectDialog from './LoggingProjectDialog.svelte';
    import TokenRevealDialog from './TokenRevealDialog.svelte';
    import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

    let logs = $state<Log[]>([]);
    let projects = $state<LoggingProject[]>([]);
    let isLoading = $state(true);
    let activeTab = $state("logs");

    let page = $state(1);
    let totalItems = $state(0);
    let totalPages = $state(1);
    let isRealtime = $state(true);
    let filter = $state<LogFilter>({
        level: []
    });

    let showProjectDialog = $state(false);
    let showTokenReveal = $state(false);
    let showDeleteConfirm = $state(false);
    let selectedProject = $state<LoggingProject | null>(null);
    let projectToDelete = $state<LoggingProject | null>(null);
    let newlyCreatedToken = $state("");
    let newlyCreatedProjectName = $state("");

    const hasMore = $derived(page < totalPages);
    const realtimeCount = $derived(logs.filter(l => !l.expand?.project).length);

    useDebouncedFilter(
        () => filter,
        () => {
            if (!isRealtime && activeTab === "logs") {
                loadLogs(true);
            }
        },
        SEARCH_DEBOUNCE_MS
    );

    async function loadLogs(reset = false) {
        if (reset) {
            page = 1;
            logs = [];
        }

        isLoading = true;
        await withErrorHandling(
            async () => {
                const result = await LoggingService.fetchLogs(page, undefined, filter);
                if (reset) {
                    logs = result.items;
                } else {
                    logs = [...logs, ...result.items];
                }
                totalItems = result.totalItems;
                totalPages = result.totalPages;
            },
            {
                errorMessage: 'Failed to fetch logs',
                onSuccess: () => {
                    if (reset) {
                        animateLogs();
                    }
                }
            }
        );
        isLoading = false;
    }

    async function loadProjects() {
        await withErrorHandling(async () => {
            projects = await LoggingService.fetchProjects();
        });
    }

    function handleCreateProject() {
        selectedProject = null;
        showProjectDialog = true;
    }

    function handleEditProject(project: LoggingProject) {
        selectedProject = project;
        showProjectDialog = true;
    }

    function handleDeleteProject(project: LoggingProject) {
        projectToDelete = project;
        showDeleteConfirm = true;
    }

    async function handleProjectSubmit(data: LoggingProjectFormData) {
        if (selectedProject) {

            await withErrorHandling(() => LoggingService.updateProject(selectedProject!.id, data), {
                successMessage: "Project updated successfully",
                errorMessage: "Failed to update project",
                onSuccess: async () => {
                    showProjectDialog = false;
                    await loadProjects();
                }
            });
        } else {

            await withErrorHandling(() => LoggingService.createProject(data), {
                successMessage: "Project created successfully",
                errorMessage: "Failed to create project",
                onSuccess: async (result) => {
                    showProjectDialog = false;
                    newlyCreatedToken = result.token;
                    newlyCreatedProjectName = result.project.name;
                    showTokenReveal = true;
                    await loadProjects();
                }
            });
        }
    }

    async function confirmDeleteProject() {
        if (!projectToDelete) return;

        await withErrorHandling(() => LoggingService.deleteProject(projectToDelete!.id), {
            successMessage: "Project deleted successfully",
            errorMessage: "Failed to delete project",
            onSuccess: async () => {
                showDeleteConfirm = false;
                projectToDelete = null;
                await loadProjects();
            }
        });
    }

    function animateLogs() {
        setTimeout(() => {
            animate('.log-row', {
                opacity: [0, 1],
                translateX: [-10, 0],
                delay: stagger(20),
                duration: 400,
                easing: 'easeOutCubic'
            });
        }, 0);
    }

    function handleNewLog(log: Log) {
        if (!isRealtime) return;

        if (filter.projectId && log.project !== filter.projectId) return;
        if (filter.level?.length && !filter.level.includes(log.level)) return;
        if (filter.searchQuery && !log.message.toLowerCase().includes(filter.searchQuery.toLowerCase())) return;

        logs = [log, ...logs.slice(0, REALTIME_MAX_LOGS)];
    }

    $effect(() => {
        if (isRealtime && activeTab === "logs") {
            LoggingService.subscribeToLogs(filter.projectId, handleNewLog);
        } else {
            LoggingService.unsubscribe();
        }
    });

    onMount(async () => {
        await Promise.all([
            loadProjects(),
            loadLogs(true)
        ]);
    });

    onDestroy(() => {
        LoggingService.unsubscribe();
    });

    function handleClear() {
        logs = [];
        totalItems = 0;
    }
</script>

<div class="flex flex-col h-full bg-background overflow-hidden">
    <LogHeader totalLogs={totalItems} {realtimeCount} />

    <Tabs.Root value={activeTab} onValueChange={(v) => activeTab = v} class="flex flex-col flex-1 min-h-0">
        <div class="px-6 border-b flex items-center justify-between">
            <Tabs.List class="bg-transparent border-none h-12">
                <Tabs.Trigger value="logs" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6">
                    <List class="w-4 h-4 mr-2" /> Logs
                </Tabs.Trigger>
                <Tabs.Trigger value="projects" class="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6">
                    <LayoutGrid class="w-4 h-4 mr-2" /> Projects
                </Tabs.Trigger>
            </Tabs.List>

            {#if activeTab === "projects"}
                <Button size="sm" onclick={handleCreateProject}>
                    <Plus class="w-4 h-4 mr-2" /> New Project
                </Button>
            {/if}
        </div>

        <Tabs.Content value="logs" class="flex-1 flex flex-col min-h-0 mt-0">
            <LogFilters
                bind:filter
                bind:isRealtime
                {projects}
                onClear={handleClear}
            />

            <div class="flex-1 relative flex flex-col min-h-0">
                <LogList
                    {logs}
                    {isLoading}
                    {hasMore}
                    isRealtime={isRealtime}
                    onLoadMore={() => {
                        page++;
                        loadLogs();
                    }}
                />
            </div>
        </Tabs.Content>

        <Tabs.Content value="projects" class="flex-1 overflow-y-auto p-6 mt-0">
            {#if projects.length === 0}
                <div class="h-64 flex flex-col items-center justify-center text-center">
                    <LayoutGrid class="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                    <h3 class="text-lg font-medium">No logging projects yet</h3>
                    <p class="text-muted-foreground max-w-sm mb-6">Create your first project to start collecting logs from your applications.</p>
                    <Button onclick={handleCreateProject}>
                        <Plus class="w-4 h-4 mr-2" /> Create First Project
                    </Button>
                </div>
            {:else}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {#each projects as project (project.id)}
                        <LoggingProjectCard
                            {project}
                            onedit={() => handleEditProject(project)}
                            ondelete={() => handleDeleteProject(project)}
                        />
                    {/each}
                </div>
            {/if}
        </Tabs.Content>
    </Tabs.Root>
</div>

<LoggingProjectDialog
    bind:open={showProjectDialog}
    project={selectedProject}
    onsubmit={handleProjectSubmit}
    onclose={() => {
        showProjectDialog = false;
        selectedProject = null;
    }}
/>

<TokenRevealDialog
    bind:open={showTokenReveal}
    token={newlyCreatedToken}
    projectName={newlyCreatedProjectName}
    onclose={() => {
        showTokenReveal = false;
        newlyCreatedToken = "";
    }}
/>

<ConfirmDialog
    bind:open={showDeleteConfirm}
    title="Delete Project?"
    description="This will permanently delete the project '{projectToDelete?.name}'. Logs already collected will remain, but new logs for this project will be rejected."
    confirmText="Delete Project"
    variant="destructive"
    onconfirm={confirmDeleteProject}
/>

<style>
    :global(.log-row) {
        will-change: transform, opacity;
    }
</style>


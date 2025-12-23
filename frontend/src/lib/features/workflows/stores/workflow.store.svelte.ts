import { browser } from '$app/environment';
import { WorkflowService } from '../services/workflow.service';
import type { Workflow, Connector } from '../types';

class WorkflowStore {
    workflows = $state<Workflow[]>([]);
    selectedWorkflow = $state<Workflow | null>(null);
    connectors = $state<Connector[]>([]);
    isLoading = $state(false);
    isRefreshing = $state(false);
    isLoadingConnectors = $state(false);
    error = $state<string | null>(null);
    totalItems = $state(0);
    page = $state(1);
    perPage = $state(50);
    searchQuery = $state('');
    filterActive = $state<boolean | undefined>(undefined);

    get activeWorkflows() {
        return this.workflows.filter(w => w.active);
    }

    get inactiveWorkflows() {
        return this.workflows.filter(w => !w.active);
    }

    get hasWorkflows() {
        return this.workflows.length > 0;
    }

    async loadWorkflows(forceRefresh: boolean = false) {
        if (this.isLoading && !forceRefresh) {
            return;
        }

        this.isLoading = true;
        this.error = null;

        if (forceRefresh) {
            this.isRefreshing = true;
        }

        try {
            const result = await WorkflowService.fetchWorkflows(this.page, this.perPage, {
                searchQuery: this.searchQuery || undefined,
                active: this.filterActive
            });

            if (result) {
                this.workflows = result.items;
                this.totalItems = result.totalItems;
                this.page = result.page;
                this.perPage = result.perPage;
            } else {
                this.error = 'Failed to load workflows';
            }
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error('Error loading workflows:', error);
        } finally {
            this.isLoading = false;
            this.isRefreshing = false;
        }
    }

    async loadConnectors(forceRefresh: boolean = false) {
        if (this.isLoadingConnectors && !forceRefresh) {
            return;
        }

        if (this.connectors.length > 0 && !forceRefresh) {
            return;
        }

        this.isLoadingConnectors = true;
        try {
            const connectors = await WorkflowService.getConnectors();
            this.connectors = connectors;
        } catch (error) {
            console.error('Error loading connectors:', error);
        } finally {
            this.isLoadingConnectors = false;
        }
    }

    async createWorkflow(data: Omit<Workflow, 'id' | 'created' | 'updated'>): Promise<Workflow | null> {
        this.error = null;
        try {
            const workflow = await WorkflowService.createWorkflow(data);
            if (workflow) {
                this.workflows = [workflow, ...this.workflows];
                this.selectedWorkflow = workflow;
                return workflow;
            } else {
                this.error = 'Failed to create workflow';
                return null;
            }
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Unknown error occurred';
            return null;
        }
    }

    async updateWorkflow(id: string, data: Partial<Omit<Workflow, 'id' | 'created' | 'updated'>>): Promise<boolean> {
        this.error = null;
        try {
            const workflow = await WorkflowService.updateWorkflow(id, data);
            if (workflow) {
                const index = this.workflows.findIndex(w => w.id === id);
                if (index !== -1) {
                    this.workflows[index] = workflow;
                }
                if (this.selectedWorkflow?.id === id) {
                    this.selectedWorkflow = workflow;
                }
                return true;
            } else {
                this.error = 'Failed to update workflow';
                return false;
            }
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Unknown error occurred';
            return false;
        }
    }

    async deleteWorkflow(id: string): Promise<boolean> {
        this.error = null;
        try {
            const success = await WorkflowService.deleteWorkflow(id);
            if (success) {
                this.workflows = this.workflows.filter(w => w.id !== id);
                if (this.selectedWorkflow?.id === id) {
                    this.selectedWorkflow = null;
                }
                return true;
            } else {
                this.error = 'Failed to delete workflow';
                return false;
            }
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Unknown error occurred';
            return false;
        }
    }

    selectWorkflow(workflow: Workflow | null) {
        this.selectedWorkflow = workflow;
    }

    setSearchQuery(query: string) {
        this.searchQuery = query;
        this.page = 1;
    }

    setFilterActive(active: boolean | undefined) {
        this.filterActive = active;
        this.page = 1;
    }

    setPage(page: number) {
        this.page = page;
    }

    clearError() {
        this.error = null;
    }
}

export const workflowStore = new WorkflowStore();


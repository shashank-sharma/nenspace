import { browser } from '$app/environment';
import { pb } from '$lib/config/pocketbase';
import { WorkflowExecutionService } from '../services/workflow-execution.service';
import type { WorkflowExecution } from '../types';
import { COLLECTIONS } from '../constants';
import type { UnsubscribeFunc } from 'pocketbase';

function convertToExecution(record: any): WorkflowExecution {
    return {
        id: record.id,
        workflow_id: record.workflow_id,
        status: record.status,
        start_time: record.start_time,
        end_time: record.end_time || '',
        duration: record.duration || 0,
        logs: typeof record.logs === 'string' ? record.logs : JSON.stringify(record.logs || []),
        results: typeof record.results === 'string' ? record.results : JSON.stringify(record.results || {}),
        error_message: record.error_message,
        result_file_ids: record.result_file_ids
    };
}

class WorkflowExecutionStore {
    executionsByWorkflow = $state<Map<string, WorkflowExecution[]>>(new Map());
    selectedExecution = $state<WorkflowExecution | null>(null);
    loadingStates = $state<Map<string, { isLoading: boolean; isRefreshing: boolean }>>(new Map());
    private subscriptions = new Map<string, UnsubscribeFunc>();

    getExecutions(workflowId: string): WorkflowExecution[] {
        return this.executionsByWorkflow.get(workflowId) || [];
    }

    getExecution(id: string): WorkflowExecution | null {
        for (const executions of this.executionsByWorkflow.values()) {
            const exec = executions.find(e => e.id === id);
            if (exec) return exec;
        }
        return null;
    }

    selectExecution(id: string | null): void {
        if (!id) {
            this.selectedExecution = null;
            return;
        }
        const execution = this.getExecution(id);
        this.selectedExecution = execution || null;
    }

    upsertExecution(execution: WorkflowExecution): void {
        const workflowId = execution.workflow_id;
        const executions = this.executionsByWorkflow.get(workflowId) || [];
        const index = executions.findIndex(e => e.id === execution.id);

        let newExecutions: WorkflowExecution[];
        if (index >= 0) {
            newExecutions = [...executions];
            newExecutions[index] = execution;
        } else {
            newExecutions = [execution, ...executions].sort((a, b) => {
                const timeA = new Date(a.start_time).getTime();
                const timeB = new Date(b.start_time).getTime();
                return timeB - timeA;
            });
        }

        const newMap = new Map(this.executionsByWorkflow);
        newMap.set(workflowId, newExecutions);
        this.executionsByWorkflow = newMap;

        if (this.selectedExecution?.id === execution.id) {
            this.selectedExecution = { ...execution };
        }
    }

    async ensureExecutionLoaded(executionId: string): Promise<void> {
        const existing = this.getExecution(executionId);
        if (existing) {
            return;
        }

        try {
            const execution = await WorkflowExecutionService.getExecutionStatus(executionId);
            if (execution) {
                this.upsertExecution(execution);
                this.selectExecution(executionId);
            }
        } catch (error) {
            console.error('Failed to load execution:', error);
        }
    }

    async fetchExecutions(workflowId: string, limit: number = 20): Promise<void> {
        const currentState = this.loadingStates.get(workflowId) || { isLoading: false, isRefreshing: false };
        if (currentState.isLoading) {
            return;
        }

        this.loadingStates = new Map(this.loadingStates);
        this.loadingStates.set(workflowId, { isLoading: true, isRefreshing: currentState.isRefreshing });

        try {
            const history = await WorkflowExecutionService.getExecutionHistory(workflowId, limit);
            const sortedExecutions = history.sort((a, b) => {
                const timeA = new Date(a.start_time).getTime();
                const timeB = new Date(b.start_time).getTime();
                return timeB - timeA;
            });

            const newMap = new Map(this.executionsByWorkflow);
            newMap.set(workflowId, sortedExecutions);
            this.executionsByWorkflow = newMap;
        } catch (error) {
            console.error('Failed to fetch executions:', error);
        } finally {
            this.loadingStates = new Map(this.loadingStates);
            this.loadingStates.set(workflowId, { isLoading: false, isRefreshing: false });
        }
    }

    async refreshExecutions(workflowId: string): Promise<void> {
        const currentState = this.loadingStates.get(workflowId) || { isLoading: false, isRefreshing: false };
        this.loadingStates = new Map(this.loadingStates);
        this.loadingStates.set(workflowId, { isLoading: currentState.isLoading, isRefreshing: true });
        try {
            await this.fetchExecutions(workflowId);
        } finally {
            const state = this.loadingStates.get(workflowId) || { isLoading: false, isRefreshing: false };
            this.loadingStates = new Map(this.loadingStates);
            this.loadingStates.set(workflowId, { isLoading: state.isLoading, isRefreshing: false });
        }
    }

    async subscribeToWorkflow(workflowId: string): Promise<void> {
        if (this.subscriptions.has(workflowId)) {
            return;
        }

        if (!browser) {
            return;
        }

        try {
            const unsubscribe = await pb.collection(COLLECTIONS.WORKFLOW_EXECUTIONS)
                .subscribe('*', (e: { action: string; record: any }) => {
                    if (!e.record || e.record.workflow_id !== workflowId) {
                        return;
                    }

                    if (e.action === 'create') {
                        this.handleExecutionCreate(e.record);
                    } else if (e.action === 'update') {
                        this.handleExecutionUpdate(e.record);
                    } else if (e.action === 'delete') {
                        this.handleExecutionDelete(e.record);
                    }
                });

            this.subscriptions.set(workflowId, unsubscribe);
        } catch (error) {
            console.error('Failed to subscribe to workflow executions:', error);
        }
    }

    unsubscribeFromWorkflow(workflowId: string): void {
        const unsubscribe = this.subscriptions.get(workflowId);
        if (unsubscribe) {
            unsubscribe();
            this.subscriptions.delete(workflowId);
        }
    }

    private handleExecutionCreate(record: any): void {
        const execution = convertToExecution(record);
        const workflowId = execution.workflow_id;
        const executions = this.executionsByWorkflow.get(workflowId) || [];

        const exists = executions.some(e => e.id === execution.id);
        if (!exists) {
            const newExecutions = [execution, ...executions].sort((a, b) => {
                const timeA = new Date(a.start_time).getTime();
                const timeB = new Date(b.start_time).getTime();
                return timeB - timeA;
            });
            const newMap = new Map(this.executionsByWorkflow);
            newMap.set(workflowId, newExecutions);
            this.executionsByWorkflow = newMap;
        }
    }

    private handleExecutionUpdate(record: any): void {
        const execution = convertToExecution(record);
        const workflowId = execution.workflow_id;
        const executions = this.executionsByWorkflow.get(workflowId) || [];
        const index = executions.findIndex(e => e.id === execution.id);

        let newExecutions: WorkflowExecution[];
        if (index >= 0) {
            newExecutions = [...executions];
            newExecutions[index] = execution;
        } else {
            newExecutions = [execution, ...executions].sort((a, b) => {
                const timeA = new Date(a.start_time).getTime();
                const timeB = new Date(b.start_time).getTime();
                return timeB - timeA;
            });
        }

        const newMap = new Map(this.executionsByWorkflow);
        newMap.set(workflowId, newExecutions);
        this.executionsByWorkflow = newMap;

        if (this.selectedExecution?.id === execution.id) {
            this.selectedExecution = { ...execution };
        }
    }

    private handleExecutionDelete(record: any): void {
        const executionId = record.id;
        const workflowId = record.workflow_id;
        const executions = this.executionsByWorkflow.get(workflowId) || [];
        const filtered = executions.filter(e => e.id !== executionId);

        this.executionsByWorkflow = new Map(this.executionsByWorkflow);
        this.executionsByWorkflow.set(workflowId, filtered);

        if (this.selectedExecution?.id === executionId) {
            this.selectedExecution = null;
        }
    }

    isLoading(workflowId: string): boolean {
        return this.loadingStates.get(workflowId)?.isLoading || false;
    }

    isRefreshing(workflowId: string): boolean {
        return this.loadingStates.get(workflowId)?.isRefreshing || false;
    }

    reset(): void {
        this.subscriptions.forEach((unsubscribe) => unsubscribe());
        this.subscriptions.clear();
        this.executionsByWorkflow.clear();
        this.selectedExecution = null;
        this.loadingStates.clear();
    }
}

export const workflowExecutionStore = new WorkflowExecutionStore();


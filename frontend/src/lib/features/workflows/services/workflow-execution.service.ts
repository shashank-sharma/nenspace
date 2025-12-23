import { browser } from '$app/environment';
import { pb } from '$lib/config/pocketbase';
import { NetworkService } from '$lib/services/network.service.svelte';
import type { WorkflowExecution, ExecutionLog } from '../types';
import type { RecordModel } from 'pocketbase';
import { COLLECTIONS } from '../constants';

function convertToWorkflowExecution(record: RecordModel): WorkflowExecution {
    return {
        id: record.id,
        workflow_id: record.workflow_id,
        status: record.status,
        start_time: record.start_time,
        end_time: record.end_time || '',
        duration: record.duration || 0,
        logs: record.logs || '[]',
        results: record.results || '{}',
        error_message: record.error_message,
        result_file_ids: record.result_file_ids
    };
}

class WorkflowExecutionServiceImpl {
    async getExecutionStatus(executionId: string): Promise<WorkflowExecution | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const response = await pb.send(`/api/workflows/executions/${executionId}`, {
                method: 'GET'
            }) as any;

            NetworkService.reportSuccess();

            // Handle response wrapped in data object (like { data: { ... }, success: true })
            const executionData = response.data || response;

            if (!executionData || !executionData.id) {
                console.error('Invalid execution response:', response);
                return null;
            }

            return {
                id: executionData.id,
                workflow_id: executionData.workflow_id,
                status: executionData.status,
                start_time: executionData.start_time,
                end_time: executionData.end_time || '',
                duration: executionData.duration || 0,
                logs: typeof executionData.logs === 'string' ? executionData.logs : JSON.stringify(executionData.logs || []),
                results: typeof executionData.results === 'string' ? executionData.results : JSON.stringify(executionData.results || {}),
                error_message: executionData.error_message,
                result_file_ids: executionData.result_file_ids
            };
        } catch (error) {
            console.error('Failed to get execution status:', error);
            NetworkService.reportFailure();
            return null;
        }
    }

    async getExecutionHistory(workflowId: string, limit: number = 10): Promise<WorkflowExecution[]> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const response = await pb.send(`/api/workflows/workflow/${workflowId}/executions?limit=${limit}`, {
                method: 'GET'
            }) as any;

            NetworkService.reportSuccess();

            const responseData = response.data || response;
            const executions = responseData.executions || [];

            return executions.map((exec: any) => ({
                id: exec.id,
                workflow_id: exec.workflow_id,
                status: exec.status,
                start_time: exec.start_time,
                end_time: exec.end_time || '',
                duration: exec.duration || 0,
                logs: typeof exec.logs === 'string' ? exec.logs : JSON.stringify(exec.logs || []),
                results: typeof exec.results === 'string' ? exec.results : JSON.stringify(exec.results || {}),
                error_message: exec.error_message,
                result_file_ids: exec.result_file_ids
            }));
        } catch (error) {
            console.error('Failed to get execution history:', error);
            NetworkService.reportFailure();
            return [];
        }
    }

    parseLogs(logsString: string): ExecutionLog[] {
        try {
            if (!logsString || logsString === '[]') {
                return [];
            }

            const parsed = typeof logsString === 'string' ? JSON.parse(logsString) : logsString;
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('Failed to parse logs:', error);
            return [];
        }
    }

    parseResults(resultsString: string): any {
        try {
            if (!resultsString || resultsString === '{}') {
                return {};
            }

            return typeof resultsString === 'string' ? JSON.parse(resultsString) : resultsString;
        } catch (error) {
            console.error('Failed to parse results:', error);
            return {};
        }
    }

    pollExecutionStatus(
        executionId: string,
        onUpdate: (execution: WorkflowExecution) => void,
        interval: number = 1000
    ): () => void {
        let isPolling = true;
        let timeoutId: number | null = null;

        const poll = async () => {
            if (!isPolling) {
                return;
            }

            const execution = await this.getExecutionStatus(executionId);
            if (execution) {
                onUpdate(execution);

                if (execution.status === 'running') {
                    timeoutId = window.setTimeout(poll, interval);
                } else {
                    isPolling = false;
                }
            } else {
                timeoutId = window.setTimeout(poll, interval);
            }
        };

        poll();

        return () => {
            isPolling = false;
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
        };
    }
}

export const WorkflowExecutionService = new WorkflowExecutionServiceImpl();


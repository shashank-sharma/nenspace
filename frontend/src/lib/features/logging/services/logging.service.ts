import { pb } from '$lib/config/pocketbase';
import { FilterBuilder } from '$lib/utils';
import type { Log, LoggingProject, LogFilter, LoggingProjectFormData, CreateProjectResult } from '../types';
import { LOGS_PER_PAGE } from '../constants';
import type { UnsubscribeFunc } from 'pocketbase';

export class LoggingService {
    private static subscription: UnsubscribeFunc | null = null;

    static async fetchLogs(page: number, perPage: number = LOGS_PER_PAGE, filter?: LogFilter) {
        const filterBuilder = FilterBuilder.create();

        if (filter?.projectId) {
            filterBuilder.equals('project', filter.projectId);
        }

        if (filter?.level && filter.level.length > 0) {
            filterBuilder.in('level', filter.level);
        }

        if (filter?.searchQuery) {
            filterBuilder.contains('message', filter.searchQuery);
        }

        if (filter?.startDate) {
            filterBuilder.greaterThanOrEqual('timestamp', filter.startDate);
        }

        if (filter?.endDate) {
            filterBuilder.lessThanOrEqual('timestamp', filter.endDate);
        }

        const result = await pb.collection('logs').getList(page, perPage, {
            sort: '-timestamp',
            filter: filterBuilder.build(),
            expand: 'project'
        });

        return {
            items: result.items as unknown as Log[],
            totalItems: result.totalItems,
            totalPages: result.totalPages
        };
    }

    static async fetchProjects(): Promise<LoggingProject[]> {
        const result = await pb.collection('logging_projects').getFullList({
            sort: 'name'
        });
        return result as unknown as LoggingProject[];
    }

    static async createProject(data: LoggingProjectFormData): Promise<CreateProjectResult> {
        const response = await pb.send('/api/logging/projects', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        return {
            project: response.project as LoggingProject,
            token: response.token as string
        };
    }

    static async updateProject(id: string, data: Partial<LoggingProjectFormData>): Promise<LoggingProject> {
        const result = await pb.collection('logging_projects').update(id, data);
        return result as unknown as LoggingProject;
    }

    static async deleteProject(id: string): Promise<void> {
        await pb.collection('logging_projects').delete(id);
    }

    static async subscribeToLogs(projectId: string | undefined, onLog: (log: Log) => void) {
        this.unsubscribe();

        const filter = projectId ? `project = "${projectId}"` : '';

        this.subscription = await pb.collection('logs').subscribe('*', (data) => {
            if (data.action === 'create') {
                onLog(data.record as unknown as Log);
            }
        }, { filter });

        return this.subscription;
    }

    static unsubscribe() {
        if (this.subscription) {
            this.subscription();
            this.subscription = null;
        }
    }
}


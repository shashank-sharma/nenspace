export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface Log {
    id: string;
    project: string;
    level: LogLevel;
    timestamp: string;
    source: string;
    message: string;
    context: Record<string, any>;
    trace_id: string;
    created: string;
    updated: string;
    expand?: {
        project?: LoggingProject;
    };
}

export interface LoggingProject {
    id: string;
    name: string;
    slug: string;
    retention: number;
    active: boolean;
    created: string;
    updated: string;
}

export interface LogFilter {
    searchQuery?: string;
    level?: LogLevel[];
    projectId?: string;
    startDate?: string;
    endDate?: string;
}

export interface LoggingProjectFormData {
    name: string;
    slug: string;
    retention: number;
}

export interface CreateProjectResult {
    project: LoggingProject;
    token: string;
}


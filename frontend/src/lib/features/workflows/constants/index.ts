export const WORKFLOW_STATUS = {
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
} as const;

export const NODE_TYPES = {
    SOURCE: 'source',
    PROCESSOR: 'processor',
    DESTINATION: 'destination'
} as const;

export const COLLECTIONS = {
    WORKFLOWS: 'workflows',
    WORKFLOW_NODES: 'workflow_nodes',
    WORKFLOW_CONNECTIONS: 'workflow_connections',
    WORKFLOW_EXECUTIONS: 'workflow_executions'
} as const;

export const DEFAULT_TIMEOUT = 3600;
export const DEFAULT_MAX_RETRIES = 0;
export const DEFAULT_RETRY_DELAY = 1;

export const NODE_COLORS = {
    source: 'hsl(142, 71%, 45%)',
    processor: 'hsl(217, 91%, 60%)',
    destination: 'hsl(25, 95%, 53%)'
} as const;

export const STATUS_COLORS = {
    running: 'hsl(217, 91%, 60%)',
    completed: 'hsl(142, 71%, 45%)',
    failed: 'hsl(0, 84%, 60%)',
    cancelled: 'hsl(0, 0%, 45%)'
} as const;


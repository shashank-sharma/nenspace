export interface Workflow {
    id: string;
    name: string;
    description: string;
    active: boolean;
    user: string;
    config: any;
    timeout: number;
    max_retries: number;
    retry_delay: number;
    created: string;
    updated: string;
}

export interface WorkflowNode {
    id: string;
    workflow_id: string;
    type: 'source' | 'processor' | 'destination';
    node_type: string;
    label: string;
    config: string;
    position_x: number;
    position_y: number;
}

export interface WorkflowConnection {
    id: string;
    workflow_id: string;
    source_id: string;
    target_id: string;
}

export interface WorkflowExecution {
    id: string;
    workflow_id: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    start_time: string;
    end_time: string;
    duration: number;
    logs: string;
    results: string;
    error_message?: string;
    result_file_ids?: string;
}

export interface Connector {
    id: string;
    name: string;
    type: 'source' | 'processor' | 'destination';
    configSchema: any;
}

export interface FlowNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: {
        label: string;
        nodeType: string;
        config: any;
        workflowNodeType: 'source' | 'processor' | 'destination';
    };
}

export interface FlowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface ExecutionLog {
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    node_id?: string;
    node_type?: string;
    connector?: string;
    status?: string;
    [key: string]: any;
}

export interface FieldDefinition {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'json';
    source_node?: string;
    nullable?: boolean;
    description?: string;
}

export interface DataSchema {
    fields: FieldDefinition[];
    source_nodes: string[];
}

export interface NodeMetadata {
    node_id: string;
    node_type: string;
    schema: DataSchema;
    record_count: number;
    execution_time_ms: number;
    sources: string[];
    custom?: Record<string, any>;
}

export interface DataEnvelope {
    data: Record<string, any>[];
    metadata: NodeMetadata;
}

export interface NodeExecutionContext {
    inputSchema?: DataSchema;
    outputSchema?: DataSchema;
}


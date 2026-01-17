export interface Cron {
	id: string;
	user: string;
	name: string;
	description?: string;
	schedule: string;
	webhook_url: string;
	webhook_method: string;
	webhook_headers?: Record<string, any>;
	webhook_payload?: Record<string, any>;
	is_active: boolean;
	is_system: boolean;
	system_type?: string;
	last_run?: string;
	next_run?: string;
	timeout_seconds: number;
	notify_on_success: boolean;
	notify_on_failure: boolean;
	notification_webhook?: string;
	max_retries: number;
	retry_delay_seconds: number;
	created: string;
	updated: string;
}

export interface CronExecution {
	id: string;
	cron: string;
	user: string;
	status: 'pending' | 'running' | 'success' | 'failure' | 'timeout' | 'cancelled';
	started_at?: string;
	completed_at?: string;
	duration_ms?: number;
	http_status?: number;
	request_url?: string;
	request_method?: string;
	request_headers?: Record<string, any>;
	request_payload?: Record<string, any>;
	response_headers?: Record<string, any>;
	response_body?: string;
	error_message?: string;
	error_stack?: string;
	retry_count: number;
	is_retry: boolean;
	metadata?: Record<string, any>;
	created: string;
	updated: string;
}

export interface CronStats {
	total_runs: number;
	success_runs: number;
	failure_runs: number;
	success_rate: number;
	avg_duration_ms: number;
	last_run?: string;
}

export interface CronMetrics {
	success_rate: DataPoint[];
	execution_count: DataPoint[];
	duration_trend: DataPoint[];
	error_frequency: DataPoint[];
	status_breakdown: Record<string, number>;
}

export interface DataPoint {
	date: string;
	success_count: number;
	failure_count: number;
	avg_duration_ms: number;
	execution_count: number;
}

export interface CreateCronData {
	name: string;
	description?: string;
	schedule: string;
	webhook_url: string;
	webhook_method: string;
	webhook_headers?: Record<string, any>;
	webhook_payload?: Record<string, any>;
	timeout_seconds?: number;
	notify_on_success?: boolean;
	notify_on_failure?: boolean;
	notification_webhook?: string;
	max_retries?: number;
	retry_delay_seconds?: number;
}

export interface UpdateCronData {
	name?: string;
	description?: string;
	schedule?: string;
	webhook_url?: string;
	webhook_method?: string;
	webhook_headers?: Record<string, any>;
	webhook_payload?: Record<string, any>;
	timeout_seconds?: number;
	is_active?: boolean;
	notify_on_success?: boolean;
	notify_on_failure?: boolean;
	notification_webhook?: string;
	max_retries?: number;
	retry_delay_seconds?: number;
}

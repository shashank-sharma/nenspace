import { pb } from '$lib/config/pocketbase';
import { withErrorHandling } from '$lib/utils';
import type { Cron, CronExecution, CronStats, CronMetrics, CreateCronData, UpdateCronData } from '../types';

export function convertToCron(record: any): Cron {
	return {
		id: record.id,
		user: record.user,
		name: record.name,
		description: record.description || '',
		schedule: record.schedule,
		webhook_url: record.webhook_url,
		webhook_method: record.webhook_method || 'POST',
		webhook_headers: record.webhook_headers,
		webhook_payload: record.webhook_payload,
		is_active: record.is_active ?? true,
		is_system: record.is_system ?? false,
		system_type: record.system_type,
		last_run: record.last_run,
		next_run: record.next_run,
		timeout_seconds: record.timeout_seconds ?? 30,
		notify_on_success: record.notify_on_success ?? false,
		notify_on_failure: record.notify_on_failure ?? true,
		notification_webhook: record.notification_webhook,
		max_retries: record.max_retries ?? 0,
		retry_delay_seconds: record.retry_delay_seconds ?? 60,
		created: record.created,
		updated: record.updated
	};
}

export function convertToCronExecution(record: any): CronExecution {
	return {
		id: record.id,
		cron: record.cron,
		user: record.user,
		status: record.status,
		started_at: record.started_at,
		completed_at: record.completed_at,
		duration_ms: record.duration_ms,
		http_status: record.http_status,
		request_url: record.request_url,
		request_method: record.request_method,
		request_headers: record.request_headers,
		request_payload: record.request_payload,
		response_headers: record.response_headers,
		response_body: record.response_body,
		error_message: record.error_message,
		error_stack: record.error_stack,
		retry_count: record.retry_count ?? 0,
		is_retry: record.is_retry ?? false,
		metadata: record.metadata,
		created: record.created,
		updated: record.updated
	};
}

class CronServiceImpl {
	async fetchCrons(filters?: { is_active?: boolean; is_system?: boolean }): Promise<Cron[]> {
		return await withErrorHandling(
			async () => {
				const filterParts: string[] = [];
				if (filters?.is_active !== undefined) {
					filterParts.push(`is_active = ${filters.is_active}`);
				}
				if (filters?.is_system !== undefined) {
					filterParts.push(`is_system = ${filters.is_system}`);
				}

				const records = await pb.collection('crons').getFullList({
					sort: '-created',
					filter: filterParts.length > 0 ? filterParts.join(' && ') : undefined,
					requestKey: null
				});

				return records.map(convertToCron);
			},
			'Failed to fetch crons'
		);
	}

	async fetchCron(id: string): Promise<Cron | null> {
		return await withErrorHandling(
			async () => {
				const record = await pb.collection('crons').getOne(id, { requestKey: null });
				return convertToCron(record);
			},
			'Failed to fetch cron'
		);
	}

	async createCron(data: CreateCronData): Promise<Cron | null> {
		return await withErrorHandling(
			async () => {
				const userId = pb.authStore.model?.id;
				if (!userId) {
					throw new Error('User not authenticated');
				}

				const record = await pb.collection('crons').create({
					...data,
					user: userId
				});
				return convertToCron(record);
			},
			'Failed to create cron'
		);
	}

	async updateCron(id: string, data: UpdateCronData): Promise<Cron | null> {
		return await withErrorHandling(
			async () => {
				const record = await pb.collection('crons').update(id, data);
				return convertToCron(record);
			},
			'Failed to update cron'
		);
	}

	async deleteCron(id: string): Promise<void> {
		return await withErrorHandling(
			async () => {
				await pb.collection('crons').delete(id);
			},
			'Failed to delete cron'
		);
	}

	async pauseCron(id: string): Promise<void> {
		return await withErrorHandling(
			async () => {
				await pb.collection('crons').update(id, { is_active: false });
			},
			'Failed to pause cron'
		);
	}

	async resumeCron(id: string): Promise<void> {
		return await withErrorHandling(
			async () => {
				await pb.collection('crons').update(id, { is_active: true });
			},
			'Failed to resume cron'
		);
	}

	async testCron(id: string): Promise<CronExecution> {
		return await withErrorHandling(
			async () => {
				const response = await pb.send(`/api/crons/${id}/test`, { method: 'POST' });
				return convertToCronExecution(response);
			},
			'Failed to test cron'
		);
	}

	async fetchExecution(executionId: string): Promise<CronExecution | null> {
		return await withErrorHandling(
			async () => {
				const record = await pb.collection('cron_executions').getOne(executionId, { requestKey: null });
				return convertToCronExecution(record);
			},
			'Failed to fetch execution'
		);
	}

	async getLatestExecution(cronId: string): Promise<CronExecution | null> {
		return await withErrorHandling(
			async () => {
				const response = await pb.collection('cron_executions').getList(1, 1, {
					sort: '-created',
					filter: `cron = "${cronId}"`,
					requestKey: null
				});
				if (response.items && response.items.length > 0) {
					return convertToCronExecution(response.items[0]);
				}
				return null;
			},
			'Failed to fetch latest execution'
		);
	}

	async cloneCron(id: string, newName: string): Promise<Cron> {
		return await withErrorHandling(
			async () => {
				const response = await pb.send(`/api/crons/${id}/clone`, {
					method: 'POST',
					body: JSON.stringify({ name: newName })
				});
				return convertToCron(response);
			},
			'Failed to clone cron'
		);
	}

	async fetchExecutions(
		cronId: string,
		options?: { page?: number; perPage?: number; status?: string; startDate?: string; endDate?: string }
	): Promise<{ items: CronExecution[]; totalItems: number; page: number; perPage: number; totalPages: number }> {
		return await withErrorHandling(
			async () => {
				const filterParts: string[] = [`cron = "${cronId}"`];
				if (options?.status) {
					filterParts.push(`status = "${options.status}"`);
				}
				if (options?.startDate) {
					filterParts.push(`created >= "${options.startDate}"`);
				}
				if (options?.endDate) {
					filterParts.push(`created <= "${options.endDate}"`);
				}

				const response = await pb.collection('cron_executions').getList(
					options?.page ?? 1,
					options?.perPage ?? 20,
					{
						sort: '-created',
						filter: filterParts.join(' && '),
						requestKey: null
					}
				);

				return {
					items: response.items.map(convertToCronExecution),
					totalItems: response.totalItems,
					page: response.page,
					perPage: response.perPage,
					totalPages: response.totalPages
				};
			},
			'Failed to fetch executions'
		);
	}

	async fetchStats(cronId: string, days?: number): Promise<CronStats | null> {
		return await withErrorHandling(
			async () => {
				const queryParams = new URLSearchParams();
				if (days) {
					queryParams.set('days', String(days));
				}
				const url = `/api/crons/${cronId}/stats${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
				const response = await pb.send(url, {
					method: 'GET',
					requestKey: null
				});
				return response;
			},
			'Failed to fetch stats'
		);
	}

	async fetchMetrics(cronId: string, days?: number): Promise<CronMetrics | null> {
		return await withErrorHandling(
			async () => {
				const queryParams = new URLSearchParams();
				if (days) {
					queryParams.set('days', String(days));
				}
				const url = `/api/crons/${cronId}/metrics${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
				const response = await pb.send(url, {
					method: 'GET',
					requestKey: null
				});
				return response;
			},
			'Failed to fetch metrics'
		);
	}
}

export const cronService = new CronServiceImpl();



import { pb } from '$lib/config/pocketbase';
import { NetworkService } from '$lib/services/network.service.svelte';

export interface UsageEvent {
	credential_type: 'token' | 'dev_token' | 'api_key' | 'security_key';
	credential_id: string;
	service: string;
	endpoint: string;
	method: string;
	status_code: number;
	response_time_ms: number;
	tokens_used?: number;
	request_size_bytes?: number;
	response_size_bytes?: number;
	error_type?: string;
	error_message?: string;
	timestamp: string;
	metadata?: Record<string, any>;
}

interface UsageStats {
	total_requests: number;
	success_count: number;
	failure_count: number;
	success_rate: number;
	total_tokens: number;
	last_used_at: string;
	avg_response_time: number;
	total_connections?: number;
}

class CredentialUsageService {
	private batch: UsageEvent[] = [];
	private batchSize = 10;
	private flushInterval = 30000;
	private flushTimer: ReturnType<typeof setTimeout> | null = null;
	private isFlushing = false;

	constructor() {
		this.startFlushTimer();
	}

	trackUsage(event: Omit<UsageEvent, 'timestamp'>): void {
		const fullEvent: UsageEvent = {
			...event,
			timestamp: new Date().toISOString()
		};

		this.batch.push(fullEvent);

		if (this.batch.length >= this.batchSize) {
			this.flush();
		}
	}

	async flush(): Promise<void> {
		if (this.isFlushing || this.batch.length === 0) {
			return;
		}

		this.isFlushing = true;
		const eventsToFlush = [...this.batch];
		this.batch = [];

		if (!NetworkService.isOnline) {

			await this.queueForOfflineSync(eventsToFlush);
			this.isFlushing = false;
			return;
		}

		try {

			for (const event of eventsToFlush) {
				try {
					await pb.collection('credential_usage').create(event);
				} catch (error) {
					console.error('Failed to track credential usage:', error);

					this.batch.push(event);
				}
			}

			NetworkService.reportSuccess();
		} catch (error) {
			console.error('Failed to flush credential usage events:', error);
			NetworkService.reportFailure();

			this.batch.push(...eventsToFlush);
			await this.queueForOfflineSync(eventsToFlush);
		} finally {
			this.isFlushing = false;
		}
	}

	private async queueForOfflineSync(events: UsageEvent[]): Promise<void> {
		try {

			const queueKey = 'credential_usage_queue';
			const existing = localStorage.getItem(queueKey);
			const queue: Array<UsageEvent & { id: string; queued_at: string }> = existing ? JSON.parse(existing) : [];

			for (const event of events) {
				queue.push({
					...event,
					id: `${Date.now()}-${Math.random()}`,
					queued_at: new Date().toISOString()
				});
			}

			if (queue.length > 1000) {
				queue.splice(0, queue.length - 1000);
			}

			localStorage.setItem(queueKey, JSON.stringify(queue));
		} catch (error) {
			console.error('Failed to queue usage events for offline sync:', error);
		}
	}

	async syncQueuedEvents(): Promise<void> {
		if (!NetworkService.isOnline) {
			return;
		}

		try {
			const queueKey = 'credential_usage_queue';
			const existing = localStorage.getItem(queueKey);
			if (!existing) {
				return;
			}

			const queue: Array<UsageEvent & { id: string; queued_at: string }> = JSON.parse(existing);
			if (queue.length === 0) {
				return;
			}

			const remaining: Array<UsageEvent & { id: string; queued_at: string }> = [];

			for (const event of queue) {
				try {

					const { id, queued_at, ...eventData } = event;
					await pb.collection('credential_usage').create(eventData);
				} catch (error) {
					console.error('Failed to sync queued usage event:', error);
					remaining.push(event);
				}
			}

			if (remaining.length > 0) {
				localStorage.setItem(queueKey, JSON.stringify(remaining));
			} else {
				localStorage.removeItem(queueKey);
			}
		} catch (error) {
			console.error('Failed to sync queued usage events:', error);
		}
	}

	private startFlushTimer(): void {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
		}

		this.flushTimer = setInterval(() => {
			if (this.batch.length > 0) {
				this.flush();
			}
		}, this.flushInterval);
	}

	async getUsageStats(
		credentialType: 'token' | 'dev_token' | 'api_key' | 'security_key',
		credentialId: string
	): Promise<UsageStats | null> {
		try {
			const response = await fetch(
				`/api/credential-usage/${credentialType}/${credentialId}/stats`,
				{
					headers: {
						Authorization: `Bearer ${pb.authStore.token}`
					}
				}
			);

			if (!response.ok) {
				return null;
			}

			return await response.json();
		} catch (error) {
			console.error('Failed to fetch usage stats:', error);
			return null;
		}
	}

	async getUsageLogs(
		credentialType: 'token' | 'dev_token' | 'api_key' | 'security_key',
		credentialId: string,
		page = 1,
		perPage = 50
	): Promise<{ items: UsageEvent[]; totalItems: number; totalPages: number } | null> {
		try {
			const response = await fetch(
				`/api/credential-usage/${credentialType}/${credentialId}?page=${page}&perPage=${perPage}`,
				{
					headers: {
						Authorization: `Bearer ${pb.authStore.token}`
					}
				}
			);

			if (!response.ok) {
				return null;
			}

			return await response.json();
		} catch (error) {
			console.error('Failed to fetch usage logs:', error);
			return null;
		}
	}

	async getUsageTimeline(
		credentialType: 'token' | 'dev_token' | 'api_key' | 'security_key',
		credentialId: string,
		startDate?: string,
		endDate?: string
	): Promise<{ timeline: Array<{ date: string; total_requests: number; success_count: number; failure_count: number; total_tokens: number }> } | null> {
		try {
			let url = `/api/credential-usage/${credentialType}/${credentialId}/timeline`;
			const params = new URLSearchParams();
			if (startDate) params.append('startDate', startDate);
			if (endDate) params.append('endDate', endDate);
			if (params.toString()) url += `?${params.toString()}`;

			const response = await fetch(url, {
				headers: {
					Authorization: `Bearer ${pb.authStore.token}`
				}
			});

			if (!response.ok) {
				return null;
			}

			return await response.json();
		} catch (error) {
			console.error('Failed to fetch usage timeline:', error);
			return null;
		}
	}

	async getAllStats(): Promise<Record<string, UsageStats> | null> {
		try {
			const response = await fetch('/api/credential-usage/stats', {
				headers: {
					Authorization: `Bearer ${pb.authStore.token}`
				}
			});

			if (!response.ok) {
				return null;
			}

			const data = await response.json();
			return data.stats || {};
		} catch (error) {
			console.error('Failed to fetch all credential stats:', error);
			return null;
		}
	}
}

export const credentialUsageService = new CredentialUsageService();

if (typeof window !== 'undefined') {
	window.addEventListener('online', () => {
		credentialUsageService.syncQueuedEvents();
	});
}


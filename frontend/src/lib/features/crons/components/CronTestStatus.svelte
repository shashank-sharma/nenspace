<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { pb } from '$lib/config/pocketbase';
	import { cronService } from '../services';
	import { convertToCronExecution } from '../services/cron.service';
	import type { CronExecution } from '../types';
	import { CheckCircle2, XCircle, Clock, AlertCircle, Activity, Loader2 } from 'lucide-svelte';
	import { animate, remove } from 'animejs';

	let { cronId, onStatusUpdate } = $props<{
		cronId: string;
		onStatusUpdate?: (execution: CronExecution | null) => void;
	}>();

	let execution = $state<CronExecution | null>(null);
	let isPolling = $state(false);
	let statusElement = $state<HTMLElement | null>(null);
	let unsubscribe: (() => void) | null = null;
	let pollingInterval: ReturnType<typeof setInterval> | null = null;

	// Status colors
	const statusColors: Record<string, { bg: string; text: string; border: string }> = {
		pending: {
			bg: 'bg-gray-500/10',
			text: 'text-gray-500',
			border: 'border-gray-500/20'
		},
		running: {
			bg: 'bg-blue-500/10',
			text: 'text-blue-500',
			border: 'border-blue-500/20'
		},
		success: {
			bg: 'bg-emerald-500/10',
			text: 'text-emerald-500',
			border: 'border-emerald-500/20'
		},
		failure: {
			bg: 'bg-rose-500/10',
			text: 'text-rose-500',
			border: 'border-rose-500/20'
		},
		timeout: {
			bg: 'bg-amber-500/10',
			text: 'text-amber-500',
			border: 'border-amber-500/20'
		},
		cancelled: {
			bg: 'bg-gray-500/10',
			text: 'text-gray-500',
			border: 'border-gray-500/20'
		}
	};

	const statusIcons: Record<string, any> = {
		pending: Clock,
		running: Activity,
		success: CheckCircle2,
		failure: XCircle,
		timeout: AlertCircle,
		cancelled: XCircle
	};

	const statusLabels: Record<string, string> = {
		pending: 'Pending',
		running: 'Running',
		success: 'Success',
		failure: 'Failed',
		timeout: 'Timeout',
		cancelled: 'Cancelled'
	};

	function animateStatusChange() {
		if (!statusElement) return;

		animate(statusElement, {
			scale: [1, 1.1, 1],
			duration: 400,
			easing: 'easeOutQuad'
		});
	}

	function animatePulse() {
		if (!statusElement || !execution || execution.status !== 'running') return;

		animate(statusElement, {
			opacity: [1, 0.6, 1],
			duration: 1500,
			easing: 'easeInOutSine',
			loop: true
		});
	}

	async function pollExecution() {
		try {
			const latestExecution = await cronService.getLatestExecution(cronId);
			if (latestExecution) {
				const previousStatus = execution?.status;
				execution = latestExecution;
				
				if (previousStatus !== execution.status) {
					animateStatusChange();
					if (onStatusUpdate) {
						onStatusUpdate(execution);
					}
				}

				// Stop polling if execution is complete
				if (['success', 'failure', 'timeout', 'cancelled'].includes(execution.status)) {
					stopPolling();
					// Stop pulse animation
					if (statusElement) {
						remove(statusElement);
					}
				}
			}
		} catch (error) {
			console.error('Failed to poll execution:', error);
		}
	}

	function startPolling() {
		if (pollingInterval) return;
		isPolling = true;
		
		// Initial poll
		pollExecution();
		
		// Poll every 500ms
		pollingInterval = setInterval(pollExecution, 500);
	}

	function stopPolling() {
		if (pollingInterval) {
			clearInterval(pollingInterval);
			pollingInterval = null;
		}
		isPolling = false;
	}

	async function startTest() {
		execution = null;
		startPolling();

		// Subscribe to real-time updates
		if (unsubscribe) {
			unsubscribe();
		}

		unsubscribe = await pb.collection('cron_executions').subscribe(
			'*',
			(e: { action: string; record: any }) => {
				if (e.record.cron === cronId && (e.action === 'create' || e.action === 'update')) {
					const newExecution = convertToCronExecution(e.record);
					const previousStatus = execution?.status;
					execution = newExecution;
					
					if (previousStatus !== execution.status) {
						animateStatusChange();
						if (onStatusUpdate) {
							onStatusUpdate(execution);
						}
					}

					if (['success', 'failure', 'timeout', 'cancelled'].includes(execution.status)) {
						stopPolling();
						if (statusElement) {
							remove(statusElement);
						}
					}
				}
			}
		).then((unsub) => unsub).catch((err) => {
			console.error('Failed to subscribe to executions:', err);
			return null;
		});

		// Trigger the test
		try {
			await cronService.testCron(cronId);
		} catch (error) {
			console.error('Failed to test cron:', error);
			stopPolling();
			if (unsubscribe) {
				unsubscribe();
				unsubscribe = null;
			}
		}
	}

	$effect(() => {
		if (execution?.status === 'running' && statusElement) {
			animatePulse();
		}
	});

	onDestroy(() => {
		stopPolling();
		if (unsubscribe) {
			unsubscribe();
		}
		if (statusElement) {
			remove(statusElement);
		}
	});

	// Export function to start test from parent
	export function triggerTest() {
		startTest();
	}
</script>

{#if execution}
	{@const statusConfig = statusColors[execution.status] || statusColors.pending}
	{@const StatusIcon = statusIcons[execution.status] || Clock}
	<div
		bind:this={statusElement}
		class="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all {statusConfig.bg} {statusConfig.text} {statusConfig.border}"
	>
		{#if execution.status === 'running'}
			<Loader2 class="h-4 w-4 animate-spin" />
		{:else}
			<StatusIcon class="h-4 w-4" />
		{/if}
		<span class="text-sm font-medium">{statusLabels[execution.status]}</span>
		{#if execution.status === 'running' && execution.started_at}
			<span class="text-xs opacity-70">
				Running...
			</span>
		{:else if execution.status === 'success'}
			{#if execution.duration_ms !== undefined}
				<span class="text-xs opacity-70">
					{execution.duration_ms < 1000 ? `${Math.round(execution.duration_ms)}ms` : `${(execution.duration_ms / 1000).toFixed(2)}s`}
				</span>
			{/if}
			{#if execution.http_status}
				<span class="text-xs opacity-70">
					HTTP {execution.http_status}
				</span>
			{/if}
		{:else if execution.status === 'failure'}
			{#if execution.error_message}
				<span class="text-xs opacity-70 truncate max-w-[200px]" title={execution.error_message}>
					{execution.error_message}
				</span>
			{:else if execution.http_status}
				<span class="text-xs opacity-70">
					HTTP {execution.http_status}
				</span>
			{/if}
		{/if}
	</div>
{/if}
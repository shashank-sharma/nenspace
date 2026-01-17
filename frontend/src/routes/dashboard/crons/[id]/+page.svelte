<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import {
		ArrowLeft,
		Play,
		Pause,
		Edit,
		Trash2,
		Copy,
		RefreshCw,
		Activity,
		CheckCircle2,
		XCircle,
		Clock,
		Calendar,
		TrendingUp
	} from 'lucide-svelte';
	import { cronService } from '$lib/features/crons/services';
	import type { Cron, CronStats, CronExecution } from '$lib/features/crons/types';
	import { toast } from 'svelte-sonner';
	import CronMetrics from '$lib/features/crons/components/CronMetrics.svelte';
	import ExecutionLogViewer from '$lib/features/crons/components/ExecutionLogViewer.svelte';
	import CronForm from '$lib/features/crons/components/CronForm.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { pb } from '$lib/config/pocketbase';
	import { convertToCron, convertToCronExecution } from '$lib/features/crons/services/cron.service';
	import { Loader2 } from 'lucide-svelte';
	import { animate, remove } from 'animejs';
	import { onDestroy } from 'svelte';

	let cron = $state<Cron | null>(null);
	let stats = $state<CronStats | null>(null);
	let isLoading = $state(true);
	let showEditDialog = $state(false);
	let cronId = $derived($page.params.id);
	let unsubscribeCron: (() => void) | null = null;
	let unsubscribeExecutions: (() => void) | null = null;
	let currentCronId = $state<string | null>(null);
	let testExecution = $state<CronExecution | null>(null);
	let testStatusElement = $state<HTMLElement | null>(null);
	let testPollingInterval: ReturnType<typeof setInterval> | null = null;
	let testUnsubscribe: (() => void) | null = null;
	let resetProgress = $state(0);

	$effect(() => {
		const id = cronId;
		if (!id || id === currentCronId) return;
		
		// Reset state when cronId changes
		currentCronId = id;
		cron = null;
		stats = null;
		isLoading = true;
		
		// Clean up old subscriptions
		if (unsubscribeCron) {
			unsubscribeCron();
			unsubscribeCron = null;
		}
		if (unsubscribeExecutions) {
			unsubscribeExecutions();
			unsubscribeExecutions = null;
		}
		
		loadCron();
	});

	$effect(() => {
		if (!cronId || !cron || unsubscribeCron) return;

		pb.collection('crons')
			.subscribe(cronId, (e: { action: string; record: any }) => {
				if (e.action === 'update') {
					cron = convertToCron(e.record);
					loadStats();
				} else if (e.action === 'delete') {
					toast.error('Cron was deleted');
					goto('/dashboard/crons');
				}
			})
			.then((unsub) => {
				unsubscribeCron = unsub;
			})
			.catch((error) => {
				console.error('Failed to subscribe to cron:', error);
			});

		pb.collection('cron_executions')
			.subscribe('*', (e: { action: string; record: any }) => {
				if (e.record.cron === cronId) {
					if (e.action === 'create' || e.action === 'update') {
						loadStats();
					}
				}
			})
			.then((unsub) => {
				unsubscribeExecutions = unsub;
			})
			.catch((error) => {
				console.error('Failed to subscribe to cron executions:', error);
			});

		return () => {
			if (unsubscribeCron) {
				unsubscribeCron();
				unsubscribeCron = null;
			}
			if (unsubscribeExecutions) {
				unsubscribeExecutions();
				unsubscribeExecutions = null;
			}
		};
	});

	async function loadCron() {
		if (!cronId) return;
		isLoading = true;
		try {
			const result = await cronService.fetchCron(cronId);
			if (!result) {
				// Error toast already shown by withErrorHandling
				// Navigate away using replaceState to prevent history loops
				goto('/dashboard/crons', { replaceState: true });
				return;
			}
			cron = result;
			loadStats();
		} catch (error) {
			toast.error('Failed to load cron');
			console.error(error);
			// Navigate away using replaceState to prevent history loops
			goto('/dashboard/crons', { replaceState: true });
		} finally {
			isLoading = false;
		}
	}

	async function loadStats() {
		if (!cronId) return;
		try {
			const result = await cronService.fetchStats(cronId, 30);
			if (result) {
				stats = result;
			} else {
				stats = null;
			}
		} catch (error) {
			console.error('Failed to load stats:', error);
			stats = null;
		}
	}

	function handlePause() {
		if (!cron) return;
		cronService.pauseCron(cron.id).then(() => {
			toast.success('Cron paused');
			cron.is_active = false;
		}).catch(() => {
			toast.error('Failed to pause cron');
		});
	}

	function handleResume() {
		if (!cron) return;
		cronService.resumeCron(cron.id).then(() => {
			toast.success('Cron resumed');
			cron.is_active = true;
		}).catch(() => {
			toast.error('Failed to resume cron');
		});
	}

	async function handleTest() {
		if (!cron) return;
		
		// Reset status
		testExecution = null;
		
		// Start polling
		const pollExecution = async () => {
			try {
				const latestExecution = await cronService.getLatestExecution(cron.id);
				if (latestExecution) {
					const previousStatus = testExecution?.status;
					testExecution = latestExecution;
					
					if (previousStatus !== testExecution.status && testStatusElement) {
						animate(testStatusElement, {
							scale: [1, 1.1, 1],
							duration: 400,
							easing: 'easeOutQuad'
						});
					}

					// Stop polling if execution is complete
					if (['success', 'failure', 'timeout', 'cancelled'].includes(testExecution.status)) {
						if (testPollingInterval) {
							clearInterval(testPollingInterval);
							testPollingInterval = null;
						}
						if (testStatusElement && testExecution.status !== 'running') {
							remove(testStatusElement);
						}
						loadStats();
						
						// Auto-reset after 3 seconds for success
						if (testExecution.status === 'success') {
							const resetDuration = 3000; // 3 seconds
							const startTime = Date.now();
							resetProgress = 0;
							
							let animationFrameId: number;
							const updateProgress = () => {
								const elapsed = Date.now() - startTime;
								resetProgress = Math.min((elapsed / resetDuration) * 100, 100);
								
								if (resetProgress < 100) {
									animationFrameId = requestAnimationFrame(updateProgress);
								} else {
									// Wait a bit after reaching 100% before resetting
									setTimeout(() => {
										testExecution = null;
										resetProgress = 0;
									}, 150);
								}
							};
							
							animationFrameId = requestAnimationFrame(updateProgress);
						}
					}
				}
			} catch (error) {
				console.error('Failed to poll execution:', error);
			}
		};

		// Subscribe to real-time updates
		if (testUnsubscribe) {
			testUnsubscribe();
		}

		testUnsubscribe = await pb.collection('cron_executions').subscribe(
			'*',
			(e: { action: string; record: any }) => {
				if (e.record.cron === cron.id && (e.action === 'create' || e.action === 'update')) {
					const execution = convertToCronExecution(e.record);
					const previousStatus = testExecution?.status;
					testExecution = execution;
					
					if (testStatusElement && previousStatus !== execution.status) {
						animate(testStatusElement, {
							scale: [1, 1.1, 1],
							duration: 400,
							easing: 'easeOutQuad'
						});
					}

					if (['success', 'failure', 'timeout', 'cancelled'].includes(execution.status)) {
						if (testPollingInterval) {
							clearInterval(testPollingInterval);
							testPollingInterval = null;
						}
						if (testStatusElement) {
							remove(testStatusElement);
						}
						loadStats();
						
						// Auto-reset after 3 seconds for success
						if (execution.status === 'success') {
							const resetDuration = 3000; // 3 seconds
							const startTime = Date.now();
							resetProgress = 0;
							
							let animationFrameId: number;
							const updateProgress = () => {
								const elapsed = Date.now() - startTime;
								resetProgress = Math.min((elapsed / resetDuration) * 100, 100);
								
								if (resetProgress < 100) {
									animationFrameId = requestAnimationFrame(updateProgress);
								} else {
									// Wait a bit after reaching 100% before resetting
									setTimeout(() => {
										testExecution = null;
										resetProgress = 0;
									}, 150);
								}
							};
							
							animationFrameId = requestAnimationFrame(updateProgress);
						}
					}
				}
			}
		).then((unsub) => unsub).catch((err) => {
			console.error('Failed to subscribe to executions:', err);
			return () => {};
		});

		// Start polling
		pollExecution();
		testPollingInterval = setInterval(pollExecution, 500);

		// Trigger the test
		try {
			await cronService.testCron(cron.id);
		} catch (error) {
			console.error('Failed to test cron:', error);
			toast.error('Failed to test cron');
			if (testPollingInterval) {
				clearInterval(testPollingInterval);
				testPollingInterval = null;
			}
			if (testUnsubscribe) {
				testUnsubscribe();
				testUnsubscribe = null;
			}
		}
	}

	function getTestStatusColor(status: string) {
		switch (status) {
			case 'running':
				return 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600';
			case 'success':
				return 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600';
			case 'failure':
				return 'bg-rose-500 text-white border-rose-500 hover:bg-rose-600';
			case 'timeout':
				return 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600';
			default:
				return 'bg-gray-500 text-white border-gray-500 hover:bg-gray-600';
		}
	}

	function getTestStatusLabel(status: string) {
		switch (status) {
			case 'running':
				return 'Running...';
			case 'success':
				return 'Success';
			case 'failure':
				return 'Failed';
			case 'timeout':
				return 'Timeout';
			default:
				return status;
		}
	}

	$effect(() => {
		if (testExecution?.status === 'running' && testStatusElement) {
			animate(testStatusElement, {
				opacity: [1, 0.6, 1],
				duration: 1500,
				easing: 'easeInOutSine',
				loop: true
			});
		}
	});

	onDestroy(() => {
		if (testPollingInterval) {
			clearInterval(testPollingInterval);
		}
		if (testUnsubscribe) {
			testUnsubscribe();
		}
		if (testStatusElement) {
			remove(testStatusElement);
		}
	});

	function handleClone() {
		if (!cron) return;
		const newName = prompt('Enter name for cloned cron:', `${cron.name} (Copy)`);
		if (newName) {
			cronService.cloneCron(cron.id, newName).then((cloned) => {
				toast.success('Cron cloned successfully');
				goto(`/dashboard/crons/${cloned.id}`);
			}).catch(() => {
				toast.error('Failed to clone cron');
			});
		}
	}

	function handleDelete() {
		if (!cron) return;
		if (confirm(`Are you sure you want to delete "${cron.name}"?`)) {
			cronService.deleteCron(cron.id).then(() => {
				toast.success('Cron deleted successfully');
				goto('/dashboard/crons');
			}).catch(() => {
				toast.error('Failed to delete cron');
			});
		}
	}

	function handleUpdateSuccess() {
		showEditDialog = false;
		loadCron();
		loadStats();
	}

	function formatDate(dateString?: string): string {
		if (!dateString) return 'Never';
		return new Date(dateString).toLocaleString();
	}
</script>

<svelte:head>
	<title>{cron?.name || 'Cron'} | Dashboard</title>
</svelte:head>

<div class="container py-6 space-y-6">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" onclick={() => goto('/dashboard/crons')}>
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<div>
				<h1 class="text-3xl font-bold">{cron?.name || 'Loading...'}</h1>
				{#if cron?.description}
					<p class="text-muted-foreground">{cron.description}</p>
				{/if}
			</div>
		</div>
		<div class="flex items-center gap-2">
			{#if testExecution}
				{@const status = testExecution.status}
				<Button
					bind:this={testStatusElement}
					variant="outline"
					size="sm"
					class="relative overflow-hidden transition-all duration-300 {getTestStatusColor(status)}"
					disabled
				>
					{#if status === 'success' && resetProgress > 0}
						<div
							class="absolute inset-0 bg-black/20 transition-[width] duration-150 ease-linear"
							style="width: {resetProgress}%"
						></div>
					{/if}
					<div class="relative flex items-center gap-2">
						{#if status === 'running'}
							<Loader2 class="h-4 w-4 animate-spin" />
						{:else if status === 'success'}
							<CheckCircle2 class="h-4 w-4" />
						{:else if status === 'failure'}
							<XCircle class="h-4 w-4" />
						{:else if status === 'timeout'}
							<Clock class="h-4 w-4" />
						{/if}
						<span class="text-sm font-medium">{getTestStatusLabel(status)}</span>
						{#if status === 'success'}
							{#if testExecution.duration_ms !== undefined}
								<span class="text-xs opacity-80">
									({testExecution.duration_ms < 1000 ? `${Math.round(testExecution.duration_ms)}ms` : `${(testExecution.duration_ms / 1000).toFixed(2)}s`})
								</span>
							{/if}
							{#if testExecution.http_status}
								<span class="text-xs opacity-80">
									HTTP {testExecution.http_status}
								</span>
							{/if}
						{:else if status === 'failure'}
							{#if testExecution.error_message}
								<span class="text-xs opacity-80 truncate max-w-[200px]" title={testExecution.error_message}>
									{testExecution.error_message}
								</span>
							{:else if testExecution.http_status}
								<span class="text-xs opacity-80">
									HTTP {testExecution.http_status}
								</span>
							{/if}
						{/if}
					</div>
				</Button>
			{:else}
				<Button variant="outline" size="sm" class="transition-all duration-300" onclick={handleTest}>
					<Play class="h-4 w-4 mr-2" />
					Test
				</Button>
			{/if}
			{#if cron?.is_active}
				<Button variant="outline" size="sm" onclick={handlePause}>
					<Pause class="h-4 w-4 mr-2" />
					Pause
				</Button>
			{:else}
				<Button variant="outline" size="sm" onclick={handleResume}>
					<Play class="h-4 w-4 mr-2" />
					Resume
				</Button>
			{/if}
			<Button variant="outline" size="sm" onclick={handleClone}>
				<Copy class="h-4 w-4 mr-2" />
				Clone
			</Button>
			<Button variant="outline" size="sm" onclick={() => showEditDialog = true}>
				<Edit class="h-4 w-4 mr-2" />
				Edit
			</Button>
			<Button variant="destructive" size="sm" onclick={handleDelete}>
				<Trash2 class="h-4 w-4 mr-2" />
				Delete
			</Button>
		</div>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<p class="text-sm text-muted-foreground">Loading cron...</p>
		</div>
	{:else if cron}
		<Card.Root class="border">
			<Card.Content class="p-6">
				<div class="space-y-6">
					<div class="flex items-start justify-between">
						<div class="flex items-center gap-3">
							<div class={`p-2.5 rounded-lg ${cron.is_active ? 'bg-emerald-500/10' : 'bg-gray-500/10'}`}>
								{#if cron.is_active}
									<CheckCircle2 class="h-5 w-5 text-emerald-500" />
								{:else}
									<Pause class="h-5 w-5 text-gray-500" />
								{/if}
							</div>
							<div>
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium text-muted-foreground">Status</span>
									{#if cron.is_active}
										<span class="text-base font-semibold text-emerald-600">Active</span>
									{/if}
								</div>
								<p class="text-xs text-muted-foreground mt-0.5">
									{#if cron.is_active}
										Running and scheduled
									{:else}
										Paused
									{/if}
								</p>
							</div>
						</div>
						<div class="text-right">
							<p class="text-sm font-medium text-muted-foreground">Schedule</p>
							<code class="text-sm font-mono font-semibold mt-1 block">{cron.schedule}</code>
						</div>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
						<div class="flex items-center gap-3">
							<div class="p-2 rounded-lg bg-blue-500/10 flex-shrink-0">
								<Clock class="h-4 w-4 text-blue-500" />
							</div>
							<div>
								<p class="text-xs font-medium text-muted-foreground">Last Run</p>
								<p class="text-sm font-semibold mt-0.5">{formatDate(cron.last_run)}</p>
							</div>
						</div>
						<div class="flex items-center gap-3">
							<div class="p-2 rounded-lg bg-amber-500/10 flex-shrink-0">
								<Clock class="h-4 w-4 text-amber-500" />
							</div>
							<div>
								<p class="text-xs font-medium text-muted-foreground">Next Run</p>
								<p class="text-sm font-semibold mt-0.5">{formatDate(cron.next_run)}</p>
							</div>
						</div>
						{#if stats}
							<div class="flex items-center gap-3">
								<div class="p-2 rounded-lg bg-purple-500/10 flex-shrink-0">
									<Activity class="h-4 w-4 text-purple-500" />
								</div>
								<div>
									<p class="text-xs font-medium text-muted-foreground">Total Runs</p>
									<p class="text-sm font-semibold mt-0.5">{stats.total_runs ?? 0}</p>
								</div>
							</div>
						{/if}
					</div>

					{#if stats}
						<div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
							<div class="flex items-center gap-3">
								<div class="p-2 rounded-lg bg-emerald-500/10 flex-shrink-0">
									<CheckCircle2 class="h-4 w-4 text-emerald-500" />
								</div>
								<div class="flex-1">
									<p class="text-xs font-medium text-muted-foreground">Success Rate</p>
									<p class="text-lg font-bold mt-0.5 text-emerald-600">
										{stats.success_rate != null ? stats.success_rate.toFixed(1) : '0.0'}%
									</p>
								</div>
							</div>
							<div class="flex items-center gap-3">
								<div class="p-2 rounded-lg bg-purple-500/10 flex-shrink-0">
									<Clock class="h-4 w-4 text-purple-500" />
								</div>
								<div class="flex-1">
									<p class="text-xs font-medium text-muted-foreground">Avg Duration</p>
									<p class="text-lg font-bold mt-0.5">
										{stats.avg_duration_ms != null
											? stats.avg_duration_ms < 1000
												? `${Math.round(stats.avg_duration_ms)}ms`
												: `${(stats.avg_duration_ms / 1000).toFixed(2)}s`
											: '0ms'}
									</p>
								</div>
							</div>
							<div class="flex items-center gap-3">
								<div class="p-2 rounded-lg bg-rose-500/10 flex-shrink-0">
									<XCircle class="h-4 w-4 text-rose-500" />
								</div>
								<div class="flex-1">
									<p class="text-xs font-medium text-muted-foreground">Failures</p>
									<div class="flex items-baseline gap-2 mt-0.5">
										<p class="text-lg font-bold text-rose-600">{stats.failure_runs ?? 0}</p>
										{#if stats.total_runs && stats.total_runs > 0}
											<p class="text-xs text-muted-foreground">
												({((stats.failure_runs ?? 0) / stats.total_runs * 100).toFixed(1)}%)
											</p>
										{/if}
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>

		<Tabs value="metrics" class="space-y-4">
			<TabsList>
				<TabsTrigger value="metrics">Metrics</TabsTrigger>
				<TabsTrigger value="history">Execution History</TabsTrigger>
				<TabsTrigger value="config">Configuration</TabsTrigger>
			</TabsList>
			<TabsContent value="metrics">
				<CronMetrics cronId={cron.id} />
			</TabsContent>
			<TabsContent value="history">
				<ExecutionLogViewer cronId={cron.id} />
			</TabsContent>
			<TabsContent value="config">
				<Card.Root>
					<Card.Header>
						<Card.Title>Configuration</Card.Title>
					</Card.Header>
					<Card.Content>
						<div class="space-y-4">
							<div>
								<label class="text-sm font-semibold">Webhook URL</label>
								<p class="text-sm text-muted-foreground break-all">{cron.webhook_url}</p>
							</div>
							<div>
								<label class="text-sm font-semibold">HTTP Method</label>
								<p class="text-sm text-muted-foreground">{cron.webhook_method}</p>
							</div>
							<div>
								<label class="text-sm font-semibold">Timeout</label>
								<p class="text-sm text-muted-foreground">{cron.timeout_seconds} seconds</p>
							</div>
							<div>
								<label class="text-sm font-semibold">Max Retries</label>
								<p class="text-sm text-muted-foreground">{cron.max_retries}</p>
							</div>
							<div>
								<label class="text-sm font-semibold">Retry Delay</label>
								<p class="text-sm text-muted-foreground">{cron.retry_delay_seconds} seconds</p>
							</div>
							{#if cron.webhook_headers}
								<div>
									<label class="text-sm font-semibold">Headers</label>
									<pre class="mt-1 p-2 bg-muted rounded text-xs overflow-auto">{JSON.stringify(cron.webhook_headers, null, 2)}</pre>
								</div>
							{/if}
							{#if cron.webhook_payload}
								<div>
									<label class="text-sm font-semibold">Payload</label>
									<pre class="mt-1 p-2 bg-muted rounded text-xs overflow-auto">{JSON.stringify(cron.webhook_payload, null, 2)}</pre>
								</div>
							{/if}
						</div>
					</Card.Content>
				</Card.Root>
			</TabsContent>
		</Tabs>
	{/if}
</div>

<Dialog.Root bind:open={showEditDialog}>
	<Dialog.Content class="max-w-2xl max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Edit Cron Job</Dialog.Title>
			<Dialog.Description>
				Update cron job configuration
			</Dialog.Description>
		</Dialog.Header>
		{#if cron}
			<CronForm cron={cron} onSuccess={handleUpdateSuccess} onCancel={() => showEditDialog = false} />
		{/if}
	</Dialog.Content>
</Dialog.Root>

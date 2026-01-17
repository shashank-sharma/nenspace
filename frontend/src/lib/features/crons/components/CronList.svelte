<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Play, Pause, Trash2, Edit, Copy, CheckCircle2, Clock, Calendar, Loader2, XCircle } from 'lucide-svelte';
	import { onDestroy } from 'svelte';
	import type { Cron, CronExecution } from '../types';
	import { cronService } from '../services';
	import { pb } from '$lib/config/pocketbase';
	import { convertToCronExecution } from '../services/cron.service';
	import { toast } from 'svelte-sonner';
	import { animate, remove } from 'animejs';

	let { crons, isLoading, selectedCronId, onSelect, onDelete } = $props<{
		crons: Cron[];
		isLoading: boolean;
		selectedCronId: string | null;
		onSelect: (cron: Cron) => void;
		onDelete: (cron: Cron) => void;
	}>();

	let testStatuses = $state<Map<string, CronExecution | null>>(new Map());
	let pollingIntervals = $state<Map<string, ReturnType<typeof setInterval>>>(new Map());
	let unsubscribes = $state<Map<string, () => void>>(new Map());
	let resetTimeouts = $state<Map<string, ReturnType<typeof setTimeout>>>(new Map());
	let resetProgress = $state<Map<string, number>>(new Map());

	function formatDate(dateString?: string): string {
		if (!dateString) return 'Never';
		const date = new Date(dateString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const minutes = Math.floor(diff / (1000 * 60));
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return date.toLocaleDateString();
	}

	function handlePause(cron: Cron, event: Event) {
		event.stopPropagation();
		cronService.pauseCron(cron.id).then(() => {
			toast.success('Cron paused');
			cron.is_active = false;
		}).catch(() => {
			toast.error('Failed to pause cron');
		});
	}

	function handleResume(cron: Cron, event: Event) {
		event.stopPropagation();
		cronService.resumeCron(cron.id).then(() => {
			toast.success('Cron resumed');
			cron.is_active = true;
		}).catch(() => {
			toast.error('Failed to resume cron');
		});
	}

	async function handleTest(cron: Cron, event: Event) {
		event.stopPropagation();
		
		// Reset status
		testStatuses.set(cron.id, null);
		
		// Start polling
		const pollExecution = async () => {
			try {
				const latestExecution = await cronService.getLatestExecution(cron.id);
				if (latestExecution) {
					const previousStatus = testStatuses.get(cron.id)?.status;
					testStatuses.set(cron.id, latestExecution);

					// Stop polling if execution is complete
					if (['success', 'failure', 'timeout', 'cancelled'].includes(latestExecution.status)) {
						const interval = pollingIntervals.get(cron.id);
						if (interval) {
							clearInterval(interval);
							pollingIntervals.delete(cron.id);
						}
						
						// Auto-reset after 3 seconds for success
						if (latestExecution.status === 'success') {
							const resetDuration = 3000; // 3 seconds
							const startTime = Date.now();
							resetProgress.set(cron.id, 0);
							
							let animationFrameId: number;
							const updateProgress = () => {
								const elapsed = Date.now() - startTime;
								const progress = Math.min((elapsed / resetDuration) * 100, 100);
								resetProgress.set(cron.id, progress);
								
								if (progress < 100) {
									animationFrameId = requestAnimationFrame(updateProgress);
								} else {
									// Wait a bit after reaching 100% before resetting
									setTimeout(() => {
										testStatuses.delete(cron.id);
										resetProgress.delete(cron.id);
									}, 150);
								}
							};
							
							animationFrameId = requestAnimationFrame(updateProgress);
							
							// Store the animation frame ID for cleanup
							resetTimeouts.set(cron.id, animationFrameId as any);
						}
					}
				}
			} catch (error) {
				console.error('Failed to poll execution:', error);
			}
		};

		// Subscribe to real-time updates
		if (unsubscribes.has(cron.id)) {
			unsubscribes.get(cron.id)?.();
		}

		const unsubscribe = await pb.collection('cron_executions').subscribe(
			'*',
			(e: { action: string; record: any }) => {
				if (e.record.cron === cron.id && (e.action === 'create' || e.action === 'update')) {
					const execution = convertToCronExecution(e.record);
					testStatuses.set(cron.id, execution);

					if (['success', 'failure', 'timeout', 'cancelled'].includes(execution.status)) {
						const interval = pollingIntervals.get(cron.id);
						if (interval) {
							clearInterval(interval);
							pollingIntervals.delete(cron.id);
						}
						
						// Auto-reset after 3 seconds for success
						if (execution.status === 'success') {
							const resetDuration = 3000; // 3 seconds
							const startTime = Date.now();
							resetProgress.set(cron.id, 0);
							
							let animationFrameId: number;
							const updateProgress = () => {
								const elapsed = Date.now() - startTime;
								const progress = Math.min((elapsed / resetDuration) * 100, 100);
								resetProgress.set(cron.id, progress);
								
								if (progress < 100) {
									animationFrameId = requestAnimationFrame(updateProgress);
								} else {
									// Wait a bit after reaching 100% before resetting
									setTimeout(() => {
										testStatuses.delete(cron.id);
										resetProgress.delete(cron.id);
									}, 150);
								}
							};
							
							animationFrameId = requestAnimationFrame(updateProgress);
							
							// Store the animation frame ID for cleanup
							resetTimeouts.set(cron.id, animationFrameId as any);
						}
					}
				}
			}
		).then((unsub) => unsub).catch((err) => {
			console.error('Failed to subscribe to executions:', err);
			return () => {};
		});

		unsubscribes.set(cron.id, unsubscribe);

		// Start polling
		pollExecution();
		const interval = setInterval(pollExecution, 500);
		pollingIntervals.set(cron.id, interval);

		// Trigger the test
		try {
			await cronService.testCron(cron.id);
		} catch (error) {
			console.error('Failed to test cron:', error);
			toast.error('Failed to test cron');
			const interval = pollingIntervals.get(cron.id);
			if (interval) {
				clearInterval(interval);
				pollingIntervals.delete(cron.id);
			}
			unsubscribes.get(cron.id)?.();
			unsubscribes.delete(cron.id);
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'running':
				return 'bg-blue-500 text-white hover:bg-blue-600';
			case 'success':
				return 'bg-emerald-500 text-white hover:bg-emerald-600';
			case 'failure':
				return 'bg-rose-500 text-white hover:bg-rose-600';
			case 'timeout':
				return 'bg-amber-500 text-white hover:bg-amber-600';
			default:
				return 'bg-gray-500 text-white hover:bg-gray-600';
		}
	}

	function getStatusLabel(status: string) {
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

	function handleClone(cron: Cron, event: Event) {
		event.stopPropagation();
		const newName = prompt('Enter name for cloned cron:', `${cron.name} (Copy)`);
		if (newName) {
			cronService.cloneCron(cron.id, newName).then(() => {
				toast.success('Cron cloned successfully');
			}).catch(() => {
				toast.error('Failed to clone cron');
			});
		}
	}

	onDestroy(() => {
		// Clean up all intervals
		for (const interval of pollingIntervals.values()) {
			clearInterval(interval);
		}
		// Clean up all animation frames
		for (const frameId of resetTimeouts.values()) {
			cancelAnimationFrame(frameId as number);
		}
		// Clean up all subscriptions
		for (const unsubscribe of unsubscribes.values()) {
			unsubscribe();
		}
	});
</script>

{#if isLoading}
	<div class="flex items-center justify-center py-12">
		<p class="text-sm text-muted-foreground">Loading crons...</p>
	</div>
{:else if crons.length > 0}
	<Table.Root>
		<Table.Header>
			<Table.Row>
				<Table.Head>Name</Table.Head>
				<Table.Head>Schedule</Table.Head>
				<Table.Head>Status</Table.Head>
				<Table.Head>Last Run</Table.Head>
				<Table.Head>Next Run</Table.Head>
				<Table.Head class="text-right">Actions</Table.Head>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{#each crons as cron (cron.id)}
				<Table.Row
					class="cursor-pointer transition-colors {selectedCronId === cron.id ? 'bg-muted' : 'hover:bg-muted/50'}"
					onclick={() => onSelect(cron)}
				>
					<Table.Cell>
						<div>
							<div class="font-medium flex items-center gap-1.5">
								{#if !cron.is_active}
									<Pause class="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
								{/if}
								{cron.name}
							</div>
							{#if cron.description}
								<div class="text-sm text-muted-foreground mt-0.5 line-clamp-1">{cron.description}</div>
							{/if}
						</div>
					</Table.Cell>
					<Table.Cell>
						<code class="text-xs font-mono px-1.5 py-0.5 bg-muted rounded">{cron.schedule}</code>
					</Table.Cell>
					<Table.Cell>
						{#if cron.is_active}
							<div class="flex items-center" title="Active">
								<CheckCircle2 class="h-4 w-4 text-emerald-500" />
							</div>
						{:else}
							<div class="flex items-center" title="Paused">
								<Pause class="h-4 w-4 text-gray-500" />
							</div>
						{/if}
					</Table.Cell>
					<Table.Cell class="text-sm text-muted-foreground">
						<div class="flex items-center gap-1.5">
							<Clock class="h-3.5 w-3.5 flex-shrink-0" />
							<span class="truncate">{formatDate(cron.last_run)}</span>
						</div>
					</Table.Cell>
					<Table.Cell class="text-sm text-muted-foreground">
						<div class="flex items-center gap-1.5">
							<Clock class="h-3.5 w-3.5 flex-shrink-0" />
							<span class="truncate">{formatDate(cron.next_run)}</span>
						</div>
					</Table.Cell>
					<Table.Cell class="text-right">
						<div class="flex items-center justify-end gap-1">
							{#if testStatuses.get(cron.id)}
								{@const execution = testStatuses.get(cron.id)}
								{@const status = execution?.status || 'pending'}
								{@const progress = resetProgress.get(cron.id) || 0}
								<Button
									variant="ghost"
									size="icon"
									class="relative h-8 w-8 overflow-hidden transition-all duration-300 {getStatusColor(status)}"
									disabled
									title={getStatusLabel(status)}
								>
									{#if status === 'success' && progress > 0}
										<div
											class="absolute inset-0 bg-black/20 transition-[width] duration-150 ease-linear"
											style="width: {progress}%"
										></div>
									{/if}
									<div class="relative flex items-center justify-center">
										{#if status === 'running'}
											<Loader2 class="h-3.5 w-3.5 animate-spin" />
										{:else if status === 'success'}
											<CheckCircle2 class="h-3.5 w-3.5" />
										{:else if status === 'failure'}
											<XCircle class="h-3.5 w-3.5" />
										{/if}
									</div>
								</Button>
							{:else}
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8 transition-all duration-300"
									onclick={(e) => handleTest(cron, e)}
									title="Test cron"
								>
									<Play class="h-3.5 w-3.5" />
								</Button>
							{/if}
							{#if cron.is_active}
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8"
									onclick={(e) => handlePause(cron, e)}
									title="Pause cron"
								>
									<Pause class="h-3.5 w-3.5" />
								</Button>
							{:else}
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8"
									onclick={(e) => handleResume(cron, e)}
									title="Resume cron"
								>
									<Play class="h-3.5 w-3.5" />
								</Button>
							{/if}
							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8"
								onclick={(e) => handleClone(cron, e)}
								title="Clone cron"
							>
								<Copy class="h-3.5 w-3.5" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8"
								onclick={(e) => {
									e.stopPropagation();
									onDelete(cron);
								}}
								title="Delete cron"
							>
								<Trash2 class="h-3.5 w-3.5" />
							</Button>
						</div>
					</Table.Cell>
				</Table.Row>
			{/each}
		</Table.Body>
	</Table.Root>
{/if}

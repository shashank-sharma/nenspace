<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		ChevronDown,
		ChevronRight,
		CheckCircle2,
		XCircle,
		Clock,
		AlertTriangle,
		Activity,
		AlertCircle
	} from 'lucide-svelte';
	import type { CronExecution } from '../types';
	import { cronService } from '../services';
	import { onMount } from 'svelte';
	import { pb } from '$lib/config/pocketbase';
	import { convertToCronExecution } from '../services/cron.service';

	let { cronId } = $props<{ cronId: string }>();

	let executions = $state<CronExecution[]>([]);
	let isLoading = $state(true);
	let page = $state(1);
	let totalPages = $state(1);
	let totalItems = $state(0);
	let expandedRows = $state<Set<string>>(new Set());
	let unsubscribeExecutions: (() => void) | null = null;
	let hasInitialized = $state(false);

	$effect(() => {
		if (!cronId || hasInitialized) return;
		hasInitialized = true;
		loadExecutions().then(() => {
			if (unsubscribeExecutions) return;

			pb.collection('cron_executions')
				.subscribe('*', (e: { action: string; record: any }) => {
					if (e.record.cron === cronId) {
						if (e.action === 'create') {
							const newExecution = convertToCronExecution(e.record);
							if (page === 1) {
								executions = [newExecution, ...executions];
								totalItems++;
							} else {
								totalItems++;
							}
						} else if (e.action === 'update') {
							const updatedExecution = convertToCronExecution(e.record);
							const index = executions.findIndex(ex => ex.id === updatedExecution.id);
							if (index !== -1) {
								executions[index] = updatedExecution;
								executions = [...executions];
							}
						} else if (e.action === 'delete') {
							executions = executions.filter(ex => ex.id !== e.record.id);
							totalItems--;
						}
					}
				})
				.then((unsub) => {
					unsubscribeExecutions = unsub;
				})
				.catch((error) => {
					console.error('Failed to subscribe to cron executions:', error);
				});
		});

		return () => {
			if (unsubscribeExecutions) {
				unsubscribeExecutions();
				unsubscribeExecutions = null;
			}
		};
	});

	$effect(() => {
		if (!hasInitialized || page === 1) return;
		loadExecutions();
	});

	async function loadExecutions() {
		isLoading = true;
		try {
			const response = await cronService.fetchExecutions(cronId, { page, perPage: 20 });
			executions = response.items;
			totalPages = response.totalPages;
			totalItems = response.totalItems;
		} catch (error) {
			console.error('Failed to load executions:', error);
		} finally {
			isLoading = false;
		}
	}

	function toggleRow(id: string) {
		const newExpandedRows = new Set(expandedRows);
		if (newExpandedRows.has(id)) {
			newExpandedRows.delete(id);
		} else {
			newExpandedRows.add(id);
		}
		expandedRows = newExpandedRows;
	}

	function formatDate(dateString?: string): string {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleString();
	}

	function formatDuration(ms?: number): string {
		if (!ms) return 'N/A';
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	}

	function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' {
		if (status === 'success') return 'default';
		if (status === 'failure' || status === 'timeout') return 'destructive';
		return 'secondary';
	}

	function getStatusIcon(status: string) {
		switch (status) {
			case 'success':
				return CheckCircle2;
			case 'failure':
				return XCircle;
			case 'timeout':
				return Clock;
			case 'running':
				return Activity;
			case 'pending':
				return Clock;
			default:
				return AlertCircle;
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'success':
				return 'border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20';
			case 'failure':
				return 'border-l-4 border-l-rose-500 bg-rose-50/50 dark:bg-rose-950/20';
			case 'timeout':
				return 'border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20';
			case 'running':
				return 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20';
			case 'pending':
				return 'border-l-4 border-l-gray-500 bg-gray-50/50 dark:bg-gray-950/20';
			default:
				return '';
		}
	}

	function getStatusBadgeColor(status: string): string {
		switch (status) {
			case 'success':
				return 'bg-emerald-500 hover:bg-emerald-600 text-white';
			case 'failure':
				return 'bg-rose-500 hover:bg-rose-600 text-white';
			case 'timeout':
				return 'bg-amber-500 hover:bg-amber-600 text-white';
			case 'running':
				return 'bg-blue-500 hover:bg-blue-600 text-white';
			case 'pending':
				return 'bg-gray-500 hover:bg-gray-600 text-white';
			default:
				return 'bg-gray-500 hover:bg-gray-600 text-white';
		}
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Activity class="h-4 w-4" />
			Execution History
		</Card.Title>
		<Card.Description>Detailed logs of cron executions</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if isLoading}
			<div class="flex items-center justify-center py-12">
				<p class="text-sm text-muted-foreground">Loading executions...</p>
			</div>
		{:else if executions.length === 0}
			<div class="flex items-center justify-center py-12">
				<p class="text-sm text-muted-foreground">No executions yet</p>
			</div>
		{:else}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head class="w-12"></Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head>Started</Table.Head>
						<Table.Head>Duration</Table.Head>
						<Table.Head>HTTP Status</Table.Head>
						<Table.Head>Error</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each executions as exec (exec.id)}
						{@const StatusIcon = getStatusIcon(exec.status)}
						<Table.Row class="transition-colors hover:bg-muted/30 {getStatusColor(exec.status)}">
							<Table.Cell>
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8"
									onclick={() => toggleRow(exec.id)}
								>
									{#if expandedRows.has(exec.id)}
										<ChevronDown class="h-4 w-4" />
									{:else}
										<ChevronRight class="h-4 w-4" />
									{/if}
								</Button>
							</Table.Cell>
							<Table.Cell>
								<Badge class="{getStatusBadgeColor(exec.status)} flex items-center gap-1.5 w-fit">
									<StatusIcon class="h-3 w-3" />
									<span class="capitalize">{exec.status}</span>
								</Badge>
							</Table.Cell>
							<Table.Cell class="text-sm">
								<div class="flex items-center gap-2">
									<Clock class="h-3.5 w-3.5 text-muted-foreground" />
									{formatDate(exec.started_at)}
								</div>
							</Table.Cell>
							<Table.Cell class="text-sm">
								<span class="font-mono">{formatDuration(exec.duration_ms)}</span>
							</Table.Cell>
							<Table.Cell class="text-sm">
								{#if exec.http_status}
									{@const httpStatus = exec.http_status}
									<Badge
										variant={
											httpStatus >= 200 && httpStatus < 300
												? 'default'
												: httpStatus >= 300 && httpStatus < 400
													? 'secondary'
													: 'destructive'
										}
										class="font-mono"
									>
										{httpStatus}
									</Badge>
								{:else}
									<span class="text-muted-foreground">N/A</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-sm max-w-xs truncate">
								{#if exec.error_message}
									<div class="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
										<AlertTriangle class="h-3.5 w-3.5 flex-shrink-0" />
										<span class="truncate">{exec.error_message}</span>
									</div>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
						</Table.Row>
						{#if expandedRows.has(exec.id)}
							<Table.Row>
								<Table.Cell colspan={6} class="bg-muted/30 p-0">
									<div class="space-y-4 p-4 border-t border-border">
										{#if exec.request_url}
											<div class="space-y-2">
												<h4 class="text-sm font-semibold flex items-center gap-2">
													<Activity class="h-4 w-4 text-blue-500" />
													Request
												</h4>
												<div class="space-y-2 text-xs">
													<div><strong>URL:</strong> {exec.request_url}</div>
													<div><strong>Method:</strong> {exec.request_method}</div>
													{#if exec.request_headers}
														<div>
															<strong>Headers:</strong>
															<pre class="mt-1 p-2 bg-background rounded overflow-auto">{JSON.stringify(exec.request_headers, null, 2)}</pre>
														</div>
													{/if}
													{#if exec.request_payload}
														<div>
															<strong>Payload:</strong>
															<pre class="mt-1 p-2 bg-background rounded overflow-auto">{JSON.stringify(exec.request_payload, null, 2)}</pre>
														</div>
													{/if}
												</div>
											</div>
										{/if}

										{#if exec.http_status}
											<div class="space-y-2">
												<h4 class="text-sm font-semibold flex items-center gap-2">
													<CheckCircle2 class="h-4 w-4 text-emerald-500" />
													Response
												</h4>
												<div class="space-y-2 text-xs">
													<div><strong>Status:</strong> {exec.http_status}</div>
													{#if exec.response_headers}
														<div>
															<strong>Headers:</strong>
															<pre class="mt-1 p-2 bg-background rounded overflow-auto">{JSON.stringify(exec.response_headers, null, 2)}</pre>
														</div>
													{/if}
													{#if exec.response_body}
														<div>
															<strong>Body:</strong>
															<pre class="mt-1 p-2 bg-background rounded overflow-auto max-h-64 overflow-y-auto">{exec.response_body}</pre>
														</div>
													{/if}
												</div>
											</div>
										{/if}

										{#if exec.error_message}
											<div class="space-y-2">
												<h4 class="text-sm font-semibold flex items-center gap-2 text-rose-600 dark:text-rose-400">
													<XCircle class="h-4 w-4" />
													Error
												</h4>
												<div class="text-xs space-y-2">
													<div><strong>Message:</strong> {exec.error_message}</div>
													{#if exec.error_stack}
														<div>
															<strong>Stack Trace:</strong>
															<pre class="mt-1 p-2 bg-background rounded overflow-auto max-h-64 overflow-y-auto">{exec.error_stack}</pre>
														</div>
													{/if}
												</div>
											</div>
										{/if}
									</div>
								</Table.Cell>
							</Table.Row>
						{/if}
					{/each}
				</Table.Body>
			</Table.Root>

			{#if totalPages > 1}
				<div class="flex items-center justify-between mt-4">
					<div class="text-sm text-muted-foreground">
						Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, totalItems)} of {totalItems}
					</div>
					<div class="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={page === 1}
							onclick={() => {
								page--;
								loadExecutions();
							}}
						>
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={page >= totalPages}
							onclick={() => {
								page++;
								loadExecutions();
							}}
						>
							Next
						</Button>
					</div>
				</div>
			{/if}
		{/if}
	</Card.Content>
</Card.Root>

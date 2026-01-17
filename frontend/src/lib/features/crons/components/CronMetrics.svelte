<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Chart from '$lib/components/ui/chart';
	import { LineChart, BarChart, Spline } from 'layerchart';
	import * as Select from '$lib/components/ui/select';
	import { Badge } from '$lib/components/ui/badge';
	import { Progress } from '$lib/components/ui/progress';
	import {
		Activity,
		TrendingUp,
		TrendingDown,
		CheckCircle2,
		XCircle,
		Clock,
		BarChart3,
		AlertCircle,
		ArrowUpRight,
		ArrowDownRight,
		Minus
	} from 'lucide-svelte';
	import type { CronMetrics, DataPoint, CronStats, CronExecution } from '../types';
	import type { ChartConfig } from '$lib/components/ui/chart';
	import { cronService } from '../services';

	let { cronId, days: initialDays = 30 } = $props<{ cronId: string; days?: number }>();

	let metrics = $state<CronMetrics | null>(null);
	let stats = $state<CronStats | null>(null);
	let previousStats = $state<CronStats | null>(null);
	let recentExecutions = $state<CronExecution[]>([]);
	let allExecutions = $state<CronExecution[]>([]);
	let isLoading = $state(true);
	let days = $state(initialDays);
	let daysStr = $state(String(initialDays || '30'));
	let currentCronId = $state<string | null>(null);
	let currentDays = $state<number | null>(null);
	let scrollContainer = $state<HTMLDivElement | null>(null);

	$effect(() => {
		const newDays = Number.parseInt(daysStr) || 30;
		if (newDays !== days) {
			days = newDays;
			if (cronId) {
				loadDailyStats();
			}
		}
	});

	$effect(() => {
		if (!cronId) return;

		// Only reload if cronId or days changed
		if (cronId !== currentCronId || days !== currentDays) {
			currentCronId = cronId;
			currentDays = days;
			loadAllData();
		}
	});

	async function loadAllData() {
		if (!cronId) return;
		isLoading = true;
		try {
			const [metricsResult, statsResult, executionsResult, previousStatsResult] = await Promise.all([
				cronService.fetchMetrics(cronId, days),
				cronService.fetchStats(cronId, days),
				cronService.fetchExecutions(cronId, { page: 1, perPage: 20 }),
				cronService.fetchStats(cronId, days)
			]);

			metrics = metricsResult;
			stats = statsResult;

			try {
				previousStats = await cronService.fetchStats(cronId, days);
			} catch (e) {
				console.error('Failed to load previous stats:', e);
			}

			if (executionsResult) {
				recentExecutions = executionsResult.items;
			}

			if (metrics) {
				calculateTrends();
			}

			await loadDailyStats();
		} catch (error) {
			console.error('Failed to load data:', error);
			metrics = null;
			stats = null;
			recentExecutions = [];
			allExecutions = [];
		} finally {
			isLoading = false;
		}
	}

	async function loadDailyStats() {
		if (!cronId) return;
		try {
			const statsDays = Math.min(days, 30);
			const daysAgo = new Date();
			daysAgo.setDate(daysAgo.getDate() - statsDays);
			const startDate = daysAgo.toISOString().split('T')[0];

			const allExecutionsResult = await cronService.fetchExecutions(cronId, { 
				page: 1, 
				perPage: statsDays * 100, 
				startDate 
			});

			if (allExecutionsResult) {
				allExecutions = allExecutionsResult.items;
			}
		} catch (error) {
			console.error('Failed to load daily stats:', error);
			allExecutions = [];
		}
	}

	let trends = $state<{
		successRate: number | null;
		duration: number | null;
		executionCount: number | null;
	}>({
		successRate: null,
		duration: null,
		executionCount: null
	});

	function calculateTrends() {
		if (!metrics || !stats) return;

		// Calculate success rate trend (compare first half to second half)
		if (metrics.success_rate && metrics.success_rate.length > 1) {
			const midPoint = Math.floor(metrics.success_rate.length / 2);
			const firstHalf = metrics.success_rate.slice(0, midPoint);
			const secondHalf = metrics.success_rate.slice(midPoint);

			const firstHalfSuccess = firstHalf.reduce((sum, dp) => sum + (dp.success_count || 0), 0);
			const firstHalfTotal = firstHalf.reduce((sum, dp) => sum + (dp.execution_count || 0), 0);
			const secondHalfSuccess = secondHalf.reduce((sum, dp) => sum + (dp.success_count || 0), 0);
			const secondHalfTotal = secondHalf.reduce((sum, dp) => sum + (dp.execution_count || 0), 0);

			const firstHalfRate = firstHalfTotal > 0 ? (firstHalfSuccess / firstHalfTotal) * 100 : 0;
			const secondHalfRate = secondHalfTotal > 0 ? (secondHalfSuccess / secondHalfTotal) * 100 : 0;

			if (firstHalfRate > 0) {
				trends.successRate = ((secondHalfRate - firstHalfRate) / firstHalfRate) * 100;
			}
		}

		// Calculate duration trend
		if (metrics.duration_trend && metrics.duration_trend.length > 1) {
			const midPoint = Math.floor(metrics.duration_trend.length / 2);
			const firstHalf = metrics.duration_trend.slice(0, midPoint);
			const secondHalf = metrics.duration_trend.slice(midPoint);

			const firstHalfAvg =
				firstHalf.reduce((sum, dp) => sum + (dp.avg_duration_ms || 0), 0) / firstHalf.length;
			const secondHalfAvg =
				secondHalf.reduce((sum, dp) => sum + (dp.avg_duration_ms || 0), 0) / secondHalf.length;

			if (firstHalfAvg > 0) {
				trends.duration = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
			}
		}

		// Calculate execution count trend
		if (metrics.execution_count && metrics.execution_count.length > 1) {
			const midPoint = Math.floor(metrics.execution_count.length / 2);
			const firstHalf = metrics.execution_count.slice(0, midPoint);
			const secondHalf = metrics.execution_count.slice(midPoint);

			const firstHalfTotal = firstHalf.reduce((sum, dp) => sum + (dp.execution_count || 0), 0);
			const secondHalfTotal = secondHalf.reduce((sum, dp) => sum + (dp.execution_count || 0), 0);

			if (firstHalfTotal > 0) {
				trends.executionCount = ((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100;
			}
		}
	}

	const chartConfig: ChartConfig = {
		success_count: {
			label: 'Success',
			color: 'hsl(142, 76%, 36%)' // emerald-500
		},
		failure_count: {
			label: 'Failure',
			color: 'hsl(0, 84%, 60%)' // rose-500
		},
		avg_duration_ms: {
			label: 'Duration (ms)',
			color: 'hsl(217, 91%, 60%)' // blue-500
		},
		execution_count: {
			label: 'Executions',
			color: 'hsl(262, 83%, 58%)' // purple-500
		}
	};

	function prepareData(data: DataPoint[]) {
		if (!data || data.length === 0) return [];

		return data.map((d) => ({
			date: formatDate(d.date),
			success_count: d.success_count || 0,
			failure_count: d.failure_count || 0,
			avg_duration_ms: d.avg_duration_ms || 0,
			execution_count: d.execution_count || 0
		}));
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function formatDuration(ms?: number): string {
		if (!ms) return 'N/A';
		if (ms < 1000) return `${Math.round(ms)}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
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
				return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
			case 'failure':
				return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
			case 'timeout':
				return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
			case 'running':
				return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
			case 'pending':
				return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
			default:
				return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
		}
	}

	$effect(() => {
		if (scrollContainer && dailyStats.length > 0 && Math.min(days, 30) > 7) {
			setTimeout(() => {
				if (scrollContainer) {
					scrollContainer.scrollLeft = scrollContainer.scrollWidth;
				}
			}, 150);
		}
	});

	const dailyStats = $derived.by(() => {
		const statsDays = Math.min(days, 30);
		const daysAgo = new Date();
		daysAgo.setDate(daysAgo.getDate() - statsDays);
		
		const filteredExecutions = allExecutions.filter(e => {
			if (!e.started_at) return false;
			const execDate = new Date(e.started_at);
			return execDate >= daysAgo;
		});

		return Array.from({ length: statsDays }, (_, i) => {
			const date = new Date();
			date.setDate(date.getDate() - (statsDays - 1 - i));
			date.setHours(0, 0, 0, 0);
			const nextDate = new Date(date);
			nextDate.setDate(nextDate.getDate() + 1);

			const dayExecutions = filteredExecutions.filter(e => {
				if (!e.started_at) return false;
				const execDate = new Date(e.started_at);
				return execDate >= date && execDate < nextDate;
			});

			const success = dayExecutions.filter(e => e.status === 'success').length;
			const failure = dayExecutions.filter(e => e.status === 'failure' || e.status === 'timeout').length;

			const isToday = i === statsDays - 1;
			const isYesterday = i === statsDays - 2;
			const label = isToday ? 'Today' : isYesterday ? 'Yesterday' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

			return {
				date: new Date(date),
				label,
				success,
				failure,
				total: dayExecutions.length
			};
		});
	});
</script>

<Card.Root>
	<Card.Header>
		<div class="flex items-center justify-between">
			<Card.Title class="flex items-center gap-2">
				<BarChart3 class="h-5 w-5" />
				Metrics & Analytics
			</Card.Title>
			<div class="flex items-center gap-2">
				<Select.Root selected={{ value: daysStr, label: `${daysStr} days` }} onSelectedChange={(selected) => {
					if (selected) {
						daysStr = selected.value;
					}
				}}>
					<Select.Trigger class="w-[130px]">
						<Select.Value>{daysStr} days</Select.Value>
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="7">7 days</Select.Item>
						<Select.Item value="30">30 days</Select.Item>
						<Select.Item value="60">60 days</Select.Item>
						<Select.Item value="90">90 days</Select.Item>
					</Select.Content>
				</Select.Root>
			</div>
			</div>
		</Card.Header>
	<Card.Content>
		{#if isLoading}
			<div class="flex items-center justify-center py-12">
				<Activity class="h-5 w-5 mr-2 animate-spin text-muted-foreground" />
				<p class="text-sm text-muted-foreground">Loading metrics...</p>
			</div>
		{:else if metrics && stats}
			<div class="space-y-4">
				{#if dailyStats.length > 0}
					{@const stats = dailyStats}
					{@const maxValue = Math.max(...stats.map(d => d.success + d.failure), 1)}
					{@const barHeight = 160}
					{@const barGap = 4}
					<Card.Root>
						<Card.Header class="pb-3">
							<Card.Title class="flex items-center gap-2 text-sm">
								<Activity class="h-4 w-4" />
								Past {Math.min(days, 30)} {Math.min(days, 30) === 1 ? 'Day' : 'Days'}
							</Card.Title>
						</Card.Header>
						<Card.Content class="pt-0">
							<p class="text-xs text-muted-foreground mb-4">Success vs Failure by day</p>
							<div class="overflow-x-auto pb-3 -mx-1 px-1 scroll-smooth" bind:this={scrollContainer}>
								<div class="flex items-end gap-1.5 min-w-max" style="height: {barHeight + 60}px; align-items: flex-end;">
									{#each stats as dayStat, index}
										{@const totalHeight = dayStat.success + dayStat.failure}
										{@const successHeight = totalHeight > 0 ? (dayStat.success / maxValue) * barHeight : 0}
										{@const failureHeight = totalHeight > 0 ? (dayStat.failure / maxValue) * barHeight : 0}
										{@const minBarWidth = Math.min(days, 30) > 20 ? 12 : 16}
										<div class="flex flex-col items-center gap-1.5 flex-shrink-0 group relative cursor-pointer" style="height: {barHeight + 60}px; min-width: {minBarWidth}px;">
											<div class="w-full flex flex-col justify-end flex-shrink-0" style="height: {barHeight}px;">
												{#if dayStat.total === 0}
													<div class="w-full h-1 bg-muted/30 rounded-full"></div>
												{:else}
													<div class="w-full flex flex-col">
														{#if dayStat.failure > 0}
															<div
																class="w-full bg-rose-500 dark:bg-rose-600 transition-all hover:bg-rose-600 dark:hover:bg-rose-700"
																style="height: {failureHeight}px; min-height: {failureHeight > 0 ? '4px' : '0'}; border-radius: {dayStat.success === 0 ? '0.5rem' : '0.5rem 0.5rem 0 0'};"
															></div>
														{/if}
														{#if dayStat.success > 0 && dayStat.failure > 0}
															<div style="height: {barGap}px;"></div>
														{/if}
														{#if dayStat.success > 0}
															<div
																class="w-full bg-emerald-500 dark:bg-emerald-600 transition-all hover:bg-emerald-600 dark:hover:bg-emerald-700"
																style="height: {successHeight}px; min-height: {successHeight > 0 ? '4px' : '0'}; border-radius: {dayStat.failure === 0 ? '0.5rem' : '0 0 0.5rem 0.5rem'};"
															></div>
														{/if}
													</div>
												{/if}
											</div>
										<div class="text-[10px] text-muted-foreground text-center w-full overflow-hidden text-ellipsis whitespace-nowrap px-0.5 leading-tight mt-1">
											{dayStat.label}
										</div>
										{#if dayStat.total > 0}
											<div class="text-[10px] font-semibold text-foreground/70 mt-0.5">
												{dayStat.total}
											</div>
										{/if}
										<div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-xl border opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 whitespace-nowrap min-w-[140px]">
											<div class="font-semibold mb-2 text-sm">{dayStat.label}</div>
											<div class="space-y-1.5">
												<div class="flex items-center justify-between gap-4">
													<div class="flex items-center gap-1.5">
														<div class="w-2.5 h-2.5 bg-emerald-400 dark:bg-emerald-500 rounded-full"></div>
														<span class="text-xs">Success</span>
													</div>
													<span class="text-xs font-semibold">{dayStat.success}</span>
												</div>
												<div class="flex items-center justify-between gap-4">
													<div class="flex items-center gap-1.5">
														<div class="w-2.5 h-2.5 bg-rose-400 dark:bg-rose-500 rounded-full"></div>
														<span class="text-xs">Failure</span>
													</div>
													<span class="text-xs font-semibold">{dayStat.failure}</span>
												</div>
												<div class="pt-1.5 mt-1.5 border-t border-border">
													<div class="flex items-center justify-between gap-4">
														<span class="text-xs font-medium">Total</span>
														<span class="text-xs font-semibold">{dayStat.total}</span>
													</div>
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</Card.Content>
					</Card.Root>
				{/if}

				{#if metrics.duration_trend && metrics.duration_trend.length > 0}
					<Card.Root>
						<Card.Header class="pb-3">
							<Card.Title class="text-sm font-medium flex items-center gap-2">
								<Clock class="h-4 w-4" />
								Average Duration Trend
							</Card.Title>
						</Card.Header>
						<Card.Content class="pt-0">
							{@const chartData = prepareData(metrics.duration_trend)}
							{#if chartData.length > 0}
								{@const series = ['avg_duration_ms'].map((key, index) => ({
									key,
									label: chartConfig[key]?.label || key,
									color: chartConfig[key]?.color || `hsl(var(--chart-${index + 1}))`
								}))}
								<Chart.Container config={chartConfig} class="h-[250px]">
									<LineChart
										data={chartData}
										x="date"
										y={['avg_duration_ms']}
										padding={{ top: 10, right: 10, bottom: 20, left: 30 }}
										props={{
											xAxis: {
												tickLength: 0
											},
											yAxis: {
												ticks: 5
											},
											grid: { x: false, y: true }
										}}
									>
										<svelte:fragment slot="marks" let:series>
											{@const color = chartConfig['avg_duration_ms']?.color || 'hsl(var(--chart-3))'}
											<Spline stroke={color} class="stroke-2" />
										</svelte:fragment>
										{#snippet tooltip()}
											<Chart.Tooltip />
										{/snippet}
									</LineChart>
								</Chart.Container>
							{:else}
								<div class="text-center py-8 text-sm text-muted-foreground">No data available</div>
							{/if}
						</Card.Content>
					</Card.Root>
				{/if}

			</div>
		{:else}
			<div class="flex flex-col items-center justify-center py-12">
				<BarChart3 class="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
				<p class="text-sm text-muted-foreground">No metrics available</p>
				<p class="text-xs text-muted-foreground mt-1">
					Metrics will appear after the cron job has executed
				</p>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
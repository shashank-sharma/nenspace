<script lang="ts">
	export interface ContributionData {
		date: Date;
		status: string;
		count: number;
	}

	let {
		data,
		maxDays = 53,
		title = 'Recent Activity',
		description = 'Activity over the past period'
	}: {
		data: ContributionData[];
		maxDays?: number;
		title?: string;
		description?: string;
	} = $props();

	const gridData = $derived.by(() => {
		const grid: ContributionData[] = [];
		const now = new Date();
		const dataMap = new Map<string, ContributionData>();

		// Group data by date
		for (const item of data) {
			const dateKey = item.date.toISOString().split('T')[0];
			const existing = dataMap.get(dateKey);
			if (existing) {
				existing.count += item.count;
				// Prioritize failure/error status if any
				if (item.status === 'failure' || item.status === 'timeout' || item.status === 'error') {
					existing.status = item.status;
				}
			} else {
				dataMap.set(dateKey, {
					date: new Date(item.date),
					status: item.status,
					count: item.count
				});
			}
		}

		// Create grid for last maxDays days
		for (let i = maxDays - 1; i >= 0; i--) {
			const date = new Date(now);
			date.setDate(date.getDate() - i);
			date.setHours(0, 0, 0, 0);
			const dateKey = date.toISOString().split('T')[0];
			const itemData = dataMap.get(dateKey);
			grid.push({
				date,
				status: itemData?.status || 'none',
				count: itemData?.count || 0
			});
		}
		return grid;
	});

	function getSquareColor(status: string, count: number): string {
		if (status === 'none' || count === 0) {
			return 'bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700';
		}
		if (status === 'failure' || status === 'timeout' || status === 'error') {
			return 'bg-rose-500 hover:bg-rose-600';
		}
		// Success - intensity based on count
		if (count === 1) return 'bg-emerald-200 dark:bg-emerald-900 hover:bg-emerald-300 dark:hover:bg-emerald-800';
		if (count === 2) return 'bg-emerald-400 dark:bg-emerald-700 hover:bg-emerald-500 dark:hover:bg-emerald-600';
		if (count === 3) return 'bg-emerald-600 dark:bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500';
		return 'bg-emerald-800 dark:bg-emerald-500 hover:bg-emerald-900 dark:hover:bg-emerald-400';
	}

	function getTooltipText(item: ContributionData): string {
		const dateStr = item.date.toLocaleDateString();
		if (item.count === 0) {
			return `${dateStr}: No activity`;
		}
		const statusText =
			item.status === 'failure' || item.status === 'timeout' || item.status === 'error'
				? 'failure'
				: 'execution(s)';
		return `${dateStr}: ${item.count} ${statusText}`;
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-2 text-xs text-muted-foreground mb-2">
		<span>Less</span>
		<div class="flex gap-1">
			<div class="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-800"></div>
			<div class="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900"></div>
			<div class="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-700"></div>
			<div class="w-3 h-3 rounded-sm bg-emerald-600 dark:bg-emerald-600"></div>
			<div class="w-3 h-3 rounded-sm bg-emerald-800 dark:bg-emerald-500"></div>
		</div>
		<span>More</span>
	</div>

	<div class="flex gap-1 flex-wrap" style="max-width: 100%;">
		{#each gridData as item (item.date.toISOString())}
			<div
				class="w-3 h-3 rounded-sm {getSquareColor(item.status, item.count)} transition-colors cursor-pointer"
				title={getTooltipText(item)}
			></div>
		{/each}
	</div>
</div>
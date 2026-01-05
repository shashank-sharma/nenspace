<script lang="ts">
	import * as Chart from "$lib/components/ui/chart";
	import { AreaChart, Area } from "layerchart";
	import type { ChartConfig } from "$lib/components/ui/chart";

	interface Props {
		data: Array<Record<string, any>>;
		config: ChartConfig;
		xKey: string;
		yKeys: string[];
		height?: number;
		title?: string;
		description?: string;
	}

	let { data, config, xKey, yKeys, height = 300, title, description }: Props = $props();
</script>

<div class="space-y-2">
	{#if title}
		<div>
			<h3 class="text-sm font-medium">{title}</h3>
			{#if description}
				<p class="text-xs text-muted-foreground">{description}</p>
			{/if}
		</div>
	{/if}
	<Chart.Container config={config} class="h-[{height}px]">
		<AreaChart
			{data}
			x={xKey}
			y={yKeys}
			padding={{ top: 10, right: 10, bottom: 20, left: 30 }}
			props={{
				xAxis: {
					tickLength: 0,
				},
				yAxis: {
					ticks: 5,
				},
				grid: { x: false, y: true },
			}}
		>
			<svelte:fragment slot="marks" let:series>
				{#each series as s, index}
					{@const yKey = yKeys[index]}
					{@const color = config[yKey]?.color || `var(--chart-${(index % 5) + 1})`}
					<Area fill={color} fillOpacity={0.6} stroke={color} strokeWidth={2} />
				{/each}
			</svelte:fragment>
			{#snippet tooltip()}
				<Chart.Tooltip />
			{/snippet}
		</AreaChart>
	</Chart.Container>
</div>


<script lang="ts">
	import * as Chart from "$lib/components/ui/chart";
	import { BarChart } from "layerchart";
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

	const series = $derived(yKeys.map((key, index) => ({
		key,
		label: config[key]?.label || key,
		color: config[key]?.color || `var(--chart-${(index % 5) + 1})`,
	})));
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
		<BarChart
			{data}
			x={xKey}
			y={yKeys}
			axis="x"
			seriesLayout="group"
			{series}
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
			{#snippet tooltip()}
				<Chart.Tooltip />
			{/snippet}
		</BarChart>
	</Chart.Container>
</div>


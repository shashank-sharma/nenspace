<script lang="ts">
	import { onMount } from "svelte";
	import { credentialUsageService } from "../services/credential-usage.service";
	import * as Card from "$lib/components/ui/card";
	import { UsageLineChart, UsageBarChart } from "$lib/components/charts";
	import type { ChartConfig } from "$lib/components/ui/chart";
	import type { UsageStats } from "../services/credential-usage.service";

	interface Props {
		credentialType?: "token" | "dev_token" | "api_key" | "security_key";
		credentialId?: string;
		days?: number;
	}

	let { credentialType, credentialId, days = 30 }: Props = $props();

	let timeline = $state<Array<{ date: string; total_requests: number; success_count: number; failure_count: number; total_tokens: number }>>([]);
	let allStats = $state<Record<string, UsageStats>>({});
	let isLoading = $state(true);

	onMount(() => {
		loadData();
	});

	async function loadData() {
		isLoading = true;
		try {
			if (credentialType && credentialId) {
				const endDate = new Date().toISOString();
				const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
				const result = await credentialUsageService.getUsageTimeline(
					credentialType,
					credentialId,
					startDate,
					endDate
				);
				timeline = result?.timeline || [];
			} else if (credentialType) {
				const result = await credentialUsageService.getAllStats();
				allStats = result || {};
				const filtered: Record<string, UsageStats> = {};
				for (const [key, stats] of Object.entries(allStats)) {
					if (key.startsWith(`${credentialType}:`)) {
						filtered[key] = stats;
					}
				}
				allStats = filtered;
			} else {
				const result = await credentialUsageService.getAllStats();
				allStats = result || {};
			}
		} catch (err) {
			console.error("Failed to load usage data:", err);
		} finally {
			isLoading = false;
		}
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	}

	const chartData = $derived(timeline.map((item) => ({
		date: formatDate(item.date),
		requests: item.total_requests,
		success: item.success_count,
		failures: item.failure_count,
		tokens: item.total_tokens,
	})));

	const chartConfig = {
		requests: {
			label: "Total Requests",
			color: "var(--chart-1)",
		},
		success: {
			label: "Successful",
			color: "var(--chart-2)",
		},
		failures: {
			label: "Failed",
			color: "var(--chart-3)",
		},
		tokens: {
			label: "Tokens Used",
			color: "var(--chart-4)",
		},
	} satisfies ChartConfig;
</script>

{#if isLoading}
	<div class="flex items-center justify-center py-12">
		<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
	</div>
{:else if credentialType && credentialId}
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-sm font-medium">Usage Over Time</Card.Title>
				<Card.Description>Requests per day for the last {days} days</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if chartData.length > 0}
					<UsageLineChart
						data={chartData}
						config={chartConfig}
						xKey="date"
						yKeys={["requests"]}
						height={250}
					/>
				{:else}
					<div class="text-center py-8 text-sm text-muted-foreground">No data available</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="text-sm font-medium">Success vs Failures</Card.Title>
				<Card.Description>Request success rate breakdown</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if chartData.length > 0}
					<UsageBarChart
						data={chartData}
						config={chartConfig}
						xKey="date"
						yKeys={["success", "failures"]}
						height={250}
					/>
				{:else}
					<div class="text-center py-8 text-sm text-muted-foreground">No data available</div>
				{/if}
			</Card.Content>
		</Card.Root>

		{#if chartData.some((d) => d.tokens > 0)}
			<Card.Root class="lg:col-span-2">
				<Card.Header>
					<Card.Title class="text-sm font-medium">Token Usage</Card.Title>
					<Card.Description>Tokens consumed over time</Card.Description>
				</Card.Header>
				<Card.Content>
					<UsageLineChart
						data={chartData}
						config={chartConfig}
						xKey="date"
						yKeys={["tokens"]}
						height={250}
					/>
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
{:else if credentialType}
	<div class="space-y-4">
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-sm font-medium">
					{credentialType === "token" ? "OAuth Tokens" :
					 credentialType === "dev_token" ? "Developer Tokens" :
					 credentialType === "api_key" ? "API Keys" : "Security Keys"} Usage Overview
				</Card.Title>
				<Card.Description>Aggregated statistics for all {credentialType.replace("_", " ")}s</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if Object.keys(allStats).length > 0}
					{@const overviewData = Object.entries(allStats).map(([key, stats]) => {
						const [, id] = key.split(":");
						return {
							credential: id.substring(0, 12),
							requests: stats.total_requests,
							success: stats.success_count,
							failures: stats.failure_count,
						};
					})}
					<UsageBarChart
						data={overviewData}
						config={chartConfig}
						xKey="credential"
						yKeys={["requests", "success", "failures"]}
						height={300}
					/>
				{:else}
					<div class="text-center py-8 text-sm text-muted-foreground">No usage data available</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
{:else}
	<div class="space-y-4">
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-sm font-medium">All Credentials Usage Overview</Card.Title>
				<Card.Description>Aggregated statistics across all credential types</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if Object.keys(allStats).length > 0}
					{@const overviewData = Object.entries(allStats).map(([key, stats]) => {
						const [type, id] = key.split(":");
						return {
							credential: `${type.replace("_", " ")} (${id.substring(0, 8)})`,
							requests: stats.total_requests,
							success: stats.success_count,
							failures: stats.failure_count,
						};
					})}
					<UsageBarChart
						data={overviewData}
						config={chartConfig}
						xKey="credential"
						yKeys={["requests", "success", "failures"]}
						height={400}
					/>
				{:else}
					<div class="text-center py-8 text-sm text-muted-foreground">No usage data available</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
{/if}

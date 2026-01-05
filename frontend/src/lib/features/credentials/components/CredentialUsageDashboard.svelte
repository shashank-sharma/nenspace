<script lang="ts">
	import { onMount } from "svelte";
	import { credentialUsageService } from "../services/credential-usage.service";
	import * as Card from "$lib/components/ui/card";
	import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
	import { Badge } from "$lib/components/ui/badge";
	import { Activity, TrendingUp, AlertCircle, CheckCircle2, Key, Shield, Code, Lock } from "lucide-svelte";
	import UsageStatsCard from "./UsageStatsCard.svelte";
	import UsageTimeline from "./UsageTimeline.svelte";
	import CredentialUsageCharts from "./CredentialUsageCharts.svelte";
	import type { UsageStats } from "../services/credential-usage.service";

	interface AllStats {
		[key: string]: UsageStats;
	}

	let allStats = $state<AllStats>({});
	let isLoading = $state(true);
	let selectedCredential = $state<{ type: string; id: string } | null>(null);

	onMount(() => {
		loadAllStats();
	});

	async function loadAllStats() {
		isLoading = true;
		try {
			const result = await credentialUsageService.getAllStats();
			allStats = result || {};
		} catch (err) {
			console.error("Failed to load stats:", err);
		} finally {
			isLoading = false;
		}
	}

	function formatNumber(num: number): string {
		if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
		if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
		return num.toString();
	}

	function getTotalRequests(): number {
		return Object.values(allStats).reduce((sum, stat) => sum + stat.total_requests, 0);
	}

	function getTotalSuccess(): number {
		return Object.values(allStats).reduce((sum, stat) => sum + stat.success_count, 0);
	}

	function getTotalFailures(): number {
		return Object.values(allStats).reduce((sum, stat) => sum + stat.failure_count, 0);
	}

	function getTotalTokens(): number {
		return Object.values(allStats).reduce((sum, stat) => sum + stat.total_tokens, 0);
	}

	function getStatsByType(type: string): Array<{ id: string; stats: UsageStats }> {
		return Object.entries(allStats)
			.filter(([key]) => key.startsWith(`${type}:`))
			.map(([key, stats]) => ({
				id: key.split(":")[1],
				stats
			}));
	}

	function getIconForType(type: string) {
		switch (type) {
			case "token":
				return Key;
			case "dev_token":
				return Code;
			case "api_key":
				return Lock;
			case "security_key":
				return Shield;
			default:
				return Activity;
		}
	}
</script>

<div class="p-6 space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Credential Usage Dashboard</h1>
			<p class="text-muted-foreground mt-1">
				Monitor usage statistics for all your credentials
			</p>
		</div>
		<button
			onclick={() => loadAllStats()}
			class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
			disabled={isLoading}
		>
			{isLoading ? "Loading..." : "Refresh"}
		</button>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
		</div>
	{:else}

		<div class="mb-6">
			<CredentialUsageCharts days={30} />
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Total Requests</Card.Title>
					<Activity class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{formatNumber(getTotalRequests())}</div>
					<p class="text-xs text-muted-foreground">Across all credentials</p>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Success Rate</Card.Title>
					<CheckCircle2 class="h-4 w-4 text-green-600" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">
						{getTotalRequests() > 0
							? Math.round((getTotalSuccess() / getTotalRequests()) * 100)
							: 0}%
					</div>
					<p class="text-xs text-muted-foreground">
						{formatNumber(getTotalSuccess())} successful requests
					</p>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Failures</Card.Title>
					<AlertCircle class="h-4 w-4 text-red-600" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{formatNumber(getTotalFailures())}</div>
					<p class="text-xs text-muted-foreground">Failed requests</p>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Total Tokens</Card.Title>
					<TrendingUp class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{formatNumber(getTotalTokens())}</div>
					<p class="text-xs text-muted-foreground">Tokens consumed</p>
				</Card.Content>
			</Card.Root>
		</div>

		<Tabs value="all" class="space-y-4">
			<TabsList>
				<TabsTrigger value="all">All Credentials</TabsTrigger>
				<TabsTrigger value="tokens">OAuth Tokens</TabsTrigger>
				<TabsTrigger value="dev_tokens">Developer Tokens</TabsTrigger>
				<TabsTrigger value="api_keys">API Keys</TabsTrigger>
				<TabsTrigger value="security_keys">Security Keys</TabsTrigger>
			</TabsList>

			<TabsContent value="all" class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{#each Object.entries(allStats) as [key, stats]}
						{@const [type, id] = key.split(":")}
						{@const Icon = getIconForType(type)}
						<Card.Root class="cursor-pointer hover:border-primary transition-colors"
							onclick={() => selectedCredential = { type, id }}
						>
							<Card.Header>
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<Icon class="w-5 h-5" />
										<Card.Title class="text-sm">{type.replace("_", " ")}</Card.Title>
									</div>
									<Badge variant={stats.success_rate >= 0.95 ? "default" : "secondary"}>
										{Math.round(stats.success_rate * 100)}%
									</Badge>
								</div>
							</Card.Header>
							<Card.Content>
								<div class="space-y-2">
									<div class="flex justify-between text-sm">
										<span class="text-muted-foreground">Requests:</span>
										<span class="font-medium">{formatNumber(stats.total_requests)}</span>
									</div>
									<div class="flex justify-between text-sm">
										<span class="text-muted-foreground">Success:</span>
										<span class="font-medium text-green-600">{formatNumber(stats.success_count)}</span>
									</div>
									<div class="flex justify-between text-sm">
										<span class="text-muted-foreground">Failures:</span>
										<span class="font-medium text-red-600">{formatNumber(stats.failure_count)}</span>
									</div>
								</div>
							</Card.Content>
						</Card.Root>
					{/each}
				</div>
			</TabsContent>

			{#each ["token", "dev_token", "api_key", "security_key"] as type}
				{@const statsList = getStatsByType(type)}
				{@const Icon = getIconForType(type)}
				<TabsContent value={type.replace("_", "") + "s"} class="space-y-4">
					{#if statsList.length === 0}
						<Card.Root>
							<Card.Content class="py-8 text-center text-muted-foreground">
								No usage data available for {type.replace("_", " ")}s
							</Card.Content>
						</Card.Root>
					{:else}
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							{#each statsList as { id, stats }}
								<Card.Root class="cursor-pointer hover:border-primary transition-colors"
									onclick={() => selectedCredential = { type, id }}
								>
									<Card.Header>
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<Icon class="w-5 h-5" />
												<Card.Title class="text-sm">ID: {id.substring(0, 8)}...</Card.Title>
											</div>
											<Badge variant={stats.success_rate >= 0.95 ? "default" : "secondary"}>
												{Math.round(stats.success_rate * 100)}%
											</Badge>
										</div>
									</Card.Header>
									<Card.Content>
										<div class="space-y-2">
											<div class="flex justify-between text-sm">
												<span class="text-muted-foreground">Requests:</span>
												<span class="font-medium">{formatNumber(stats.total_requests)}</span>
											</div>
											<div class="flex justify-between text-sm">
												<span class="text-muted-foreground">Success:</span>
												<span class="font-medium text-green-600">{formatNumber(stats.success_count)}</span>
											</div>
											<div class="flex justify-between text-sm">
												<span class="text-muted-foreground">Failures:</span>
												<span class="font-medium text-red-600">{formatNumber(stats.failure_count)}</span>
											</div>
										</div>
									</Card.Content>
								</Card.Root>
							{/each}
						</div>
					{/if}
				</TabsContent>
			{/each}
		</Tabs>

		{#if selectedCredential}
			<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
				onclick={() => selectedCredential = null}
			>
				<div class="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6"
					onclick={(e) => e.stopPropagation()}
				>
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-2xl font-bold">Detailed Usage Statistics</h2>
						<button
							onclick={() => selectedCredential = null}
							class="text-muted-foreground hover:text-foreground"
						>
							✕
						</button>
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<UsageStatsCard
							credentialType={selectedCredential.type as any}
							credentialId={selectedCredential.id}
							showDetails={true}
						/>
						<UsageTimeline
							credentialType={selectedCredential.type as any}
							credentialId={selectedCredential.id}
							days={30}
						/>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>


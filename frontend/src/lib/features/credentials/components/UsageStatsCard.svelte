<script lang="ts">
	import * as Card from "$lib/components/ui/card";
	import { Badge } from "$lib/components/ui/badge";
	import { Activity, TrendingUp, Clock, AlertCircle, CheckCircle2 } from "lucide-svelte";
	import { credentialUsageService, type UsageStats } from "../services/credential-usage.service";
	import { onMount } from "svelte";

	interface Props {
		credentialType: "token" | "dev_token" | "api_key" | "security_key";
		credentialId: string;
		showDetails?: boolean;
	}

	let { credentialType, credentialId, showDetails = false }: Props = $props();

	let stats = $state<UsageStats | null>(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	onMount(() => {
		loadStats();
	});

	async function loadStats() {
		isLoading = true;
		error = null;
		try {
			const result = await credentialUsageService.getUsageStats(credentialType, credentialId);
			stats = result;
		} catch (err) {
			error = err instanceof Error ? err.message : "Failed to load stats";
		} finally {
			isLoading = false;
		}
	}

	function formatNumber(num: number): string {
		if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
		if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
		return num.toString();
	}

	function formatTime(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}
</script>

<Card.Root class="border-t-4 border-t-primary">
	<Card.Header>
		<div class="flex items-center justify-between">
			<Card.Title class="text-sm font-medium flex items-center gap-2">
				<Activity class="w-4 h-4" />
				Usage Statistics
			</Card.Title>
			{#if stats && !isLoading}
				<Badge variant={stats.success_rate >= 0.95 ? "default" : "secondary"}>
					{Math.round(stats.success_rate * 100)}% Success
				</Badge>
			{/if}
		</div>
	</Card.Header>
	<Card.Content>
		{#if isLoading}
			<div class="flex items-center justify-center py-8">
				<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
			</div>
		{:else if error}
			<div class="flex items-center gap-2 text-destructive py-4">
				<AlertCircle class="w-4 h-4" />
				<span class="text-sm">{error}</span>
			</div>
		{:else if stats}
			<div class="space-y-4">

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-1">
						<p class="text-xs text-muted-foreground">Total Requests</p>
						<p class="text-2xl font-bold">{formatNumber(stats.total_requests)}</p>
					</div>
					<div class="space-y-1">
						<p class="text-xs text-muted-foreground">Success Rate</p>
						<p class="text-2xl font-bold">{Math.round(stats.success_rate * 100)}%</p>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="flex items-center gap-2 p-2 rounded-md bg-green-50 dark:bg-green-950">
						<CheckCircle2 class="w-4 h-4 text-green-600 dark:text-green-400" />
						<div>
							<p class="text-xs text-muted-foreground">Success</p>
							<p class="text-sm font-semibold">{formatNumber(stats.success_count)}</p>
						</div>
					</div>
					<div class="flex items-center gap-2 p-2 rounded-md bg-red-50 dark:bg-red-950">
						<AlertCircle class="w-4 h-4 text-red-600 dark:text-red-400" />
						<div>
							<p class="text-xs text-muted-foreground">Failures</p>
							<p class="text-sm font-semibold">{formatNumber(stats.failure_count)}</p>
						</div>
					</div>
				</div>

				{#if showDetails}

					<div class="space-y-3 pt-2 border-t">
						{#if stats.total_tokens > 0}
							<div class="flex items-center justify-between">
								<span class="text-xs text-muted-foreground flex items-center gap-1">
									<TrendingUp class="w-3 h-3" />
									Total Tokens
								</span>
								<span class="text-sm font-medium">{formatNumber(stats.total_tokens)}</span>
							</div>
						{/if}
						<div class="flex items-center justify-between">
							<span class="text-xs text-muted-foreground flex items-center gap-1">
								<Clock class="w-3 h-3" />
								Avg Response Time
							</span>
							<span class="text-sm font-medium">{formatTime(stats.avg_response_time)}</span>
						</div>
						{#if stats.last_used_at}
							<div class="flex items-center justify-between">
								<span class="text-xs text-muted-foreground">Last Used</span>
								<span class="text-sm font-medium">
									{new Date(stats.last_used_at).toLocaleDateString()}
								</span>
							</div>
						{/if}
						{#if stats.total_connections !== undefined}
							<div class="flex items-center justify-between">
								<span class="text-xs text-muted-foreground">Total Connections</span>
								<span class="text-sm font-medium">{formatNumber(stats.total_connections)}</span>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{:else}
			<div class="text-center py-4 text-sm text-muted-foreground">
				No usage data available
			</div>
		{/if}
	</Card.Content>
</Card.Root>


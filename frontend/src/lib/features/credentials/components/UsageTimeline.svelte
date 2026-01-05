<script lang="ts">
	import { credentialUsageService } from "../services/credential-usage.service";
	import { onMount } from "svelte";
	import * as Card from "$lib/components/ui/card";

	interface Props {
		credentialType: "token" | "dev_token" | "api_key" | "security_key";
		credentialId: string;
		days?: number;
	}

	let { credentialType, credentialId, days = 7 }: Props = $props();

	let timeline = $state<Array<{ date: string; total_requests: number; success_count: number; failure_count: number; total_tokens: number }>>([]);
	let isLoading = $state(true);

	onMount(() => {
		loadTimeline();
	});

	async function loadTimeline() {
		isLoading = true;
		try {
			const endDate = new Date().toISOString();
			const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
			const result = await credentialUsageService.getUsageTimeline(
				credentialType,
				credentialId,
				startDate,
				endDate
			);
			timeline = result?.timeline || [];
		} catch (err) {
			console.error("Failed to load timeline:", err);
		} finally {
			isLoading = false;
		}
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	}

	function getMaxValue(): number {
		if (timeline.length === 0) return 100;
		return Math.max(...timeline.map((d) => d.total_requests));
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="text-sm font-medium">Usage Timeline ({days} days)</Card.Title>
	</Card.Header>
	<Card.Content>
		{#if isLoading}
			<div class="flex items-center justify-center py-8">
				<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
			</div>
		{:else if timeline.length === 0}
			<div class="text-center py-4 text-sm text-muted-foreground">No data available</div>
		{:else}
			<div class="space-y-2">
				{#each timeline as item}
					{@const maxValue = getMaxValue()}
					{@const barWidth = maxValue > 0 ? (item.total_requests / maxValue) * 100 : 0}
					<div class="space-y-1">
						<div class="flex items-center justify-between text-xs">
							<span class="text-muted-foreground">{formatDate(item.date)}</span>
							<span class="font-medium">{item.total_requests} requests</span>
						</div>
						<div class="relative h-4 bg-muted rounded-full overflow-hidden">
							<div
								class="absolute inset-y-0 left-0 bg-primary transition-all"
								style="width: {barWidth}%"
							></div>
							{#if item.failure_count > 0}
								<div
									class="absolute inset-y-0 left-0 bg-destructive transition-all"
									style="width: {maxValue > 0 ? (item.failure_count / maxValue) * 100 : 0}%"
								></div>
							{/if}
						</div>
						<div class="flex items-center gap-4 text-xs text-muted-foreground">
							<span>✓ {item.success_count}</span>
							{#if item.failure_count > 0}
								<span class="text-destructive">✗ {item.failure_count}</span>
							{/if}
							{#if item.total_tokens > 0}
								<span>🎯 {item.total_tokens.toLocaleString()} tokens</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card.Content>
</Card.Root>


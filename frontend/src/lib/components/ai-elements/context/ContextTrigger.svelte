<script lang="ts">
	import * as HoverCard from "$lib/components/ui/hover-card";
	import { Button } from "$lib/components/ui/button";
	import { Cpu } from "lucide-svelte";
	import { getContextState } from "./context.svelte.ts";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
		size?: "default" | "sm" | "lg" | "icon";
		children?: Snippet;
		class?: string;
	};

	let { variant = "ghost", size, children, class: className }: Props = $props();

	const contextState = getContextState();
	const percentage = $derived(
		contextState.maxTokens > 0
			? ((contextState.usedTokens / contextState.maxTokens) * 100).toFixed(1)
			: "0.0"
	);
</script>

<HoverCard.Trigger asChild let:builder>
	<Button
		builders={[builder]}
		{variant}
		{size}
		class={cn("gap-2", className)}
	>
		{#if children}
			{@render children()}
		{:else}
			<Cpu size={16} />
			<span class="text-xs">{percentage}%</span>
		{/if}
	</Button>
</HoverCard.Trigger>

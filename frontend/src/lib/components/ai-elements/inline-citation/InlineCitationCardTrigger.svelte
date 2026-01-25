<script lang="ts">
	import * as HoverCard from "$lib/components/ui/hover-card";
	import { Badge } from "$lib/components/ui/badge";
	import { cn } from "$lib/utils";
	import { setInlineCitationState } from "./inline-citation-context.svelte.ts";
	import type { Snippet } from "svelte";

	type Props = {
		sources: string[];
		variant?: "default" | "secondary" | "destructive" | "outline";
		class?: string;
		children?: Snippet;
	};

	let { sources, variant = "secondary", class: className, children }: Props = $props();

	setInlineCitationState({ sources });

	const hostname = $derived(() => {
		if (sources.length === 0) return "";
		try {
			return new URL(sources[0]).hostname.replace("www.", "");
		} catch {
			return "source";
		}
	});

	const displayText = $derived(
		sources.length > 1 ? `${hostname()} +${sources.length - 1}` : hostname()
	);
</script>

<HoverCard.Trigger asChild let:builder>
	<Badge
		builders={[builder]}
		{variant}
		class={cn("cursor-pointer text-xs px-1.5 py-0.5", className)}
	>
		{#if children}
			{@render children()}
		{:else}
			{displayText}
		{/if}
	</Badge>
</HoverCard.Trigger>

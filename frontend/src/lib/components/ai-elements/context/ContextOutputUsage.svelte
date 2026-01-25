<script lang="ts">
	import { getContextState } from "./context.svelte.ts";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		children?: Snippet;
		class?: string;
	};

	let { children, class: className }: Props = $props();

	const contextState = getContextState();
	const outputTokens = $derived(contextState.usage?.completionTokens ?? 0);
</script>

<div class={cn("flex items-center justify-between text-sm", className)}>
	{#if children}
		{@render children()}
	{:else}
		<span class="text-muted-foreground">Output</span>
		<span class="font-medium">{outputTokens.toLocaleString()}</span>
	{/if}
</div>

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
	const inputTokens = $derived(contextState.usage?.promptTokens ?? 0);
</script>

<div class={cn("flex items-center justify-between text-sm", className)}>
	{#if children}
		{@render children()}
	{:else}
		<span class="text-muted-foreground">Input</span>
		<span class="font-medium">{inputTokens.toLocaleString()}</span>
	{/if}
</div>

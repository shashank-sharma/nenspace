<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		completed?: boolean;
		class?: string;
		children?: Snippet;
	};

	let { completed = false, class: className, children }: Props = $props();
</script>

<div class={cn("flex-1 space-y-1", completed && "opacity-60 line-through", className)}>
	{#if children}
		{@render children()}
	{/if}
</div>

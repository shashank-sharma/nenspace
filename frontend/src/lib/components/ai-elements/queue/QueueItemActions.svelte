<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children }: Props = $props();
</script>

<div class={cn("flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity", className)}>
	{#if children}
		{@render children()}
	{/if}
</div>

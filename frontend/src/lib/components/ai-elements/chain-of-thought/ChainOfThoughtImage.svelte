<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type ChainOfThoughtImageProps = HTMLAttributes<HTMLDivElement> & {
		caption?: string;
		children: Snippet;
	};

	let {
		caption,
		children,
		class: className,
		...restProps
	}: ChainOfThoughtImageProps = $props();

	let containerClasses = $derived(cn("space-y-2", className));
</script>

<div class={containerClasses} {...restProps}>
	<div class="overflow-hidden rounded-lg border">
		{@render children()}
	</div>
	{#if caption}
		<p class="text-xs text-muted-foreground italic">{caption}</p>
	{/if}
</div>

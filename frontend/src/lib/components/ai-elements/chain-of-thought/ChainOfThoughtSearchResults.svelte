<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type ChainOfThoughtSearchResultsProps = HTMLAttributes<HTMLDivElement> & {
		children: Snippet;
	};

	let {
		children,
		class: className,
		...restProps
	}: ChainOfThoughtSearchResultsProps = $props();

	let containerClasses = $derived(
		cn("flex flex-wrap gap-2", className)
	);
</script>

<div class={containerClasses} {...restProps}>
	{@render children()}
</div>

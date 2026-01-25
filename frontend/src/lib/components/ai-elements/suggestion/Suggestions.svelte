<script lang="ts">
	import { cn } from "$lib/utils";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import type { Snippet } from "svelte";

	type SuggestionsProps = {
		children: Snippet;
		class?: string;
		orientation?: "vertical" | "horizontal" | "both";
		scrollbarXClasses?: string;
		scrollbarYClasses?: string;
	};

	let {
		children,
		class: className,
		orientation = "horizontal",
		scrollbarXClasses,
		scrollbarYClasses,
		...restProps
	}: SuggestionsProps = $props();

	let containerClasses = $derived(
		cn(
			"flex gap-2",
			orientation === "horizontal" && "flex-row overflow-x-auto",
			orientation === "vertical" && "flex-col overflow-y-auto",
			orientation === "both" && "flex-wrap",
			className
		)
	);
</script>

{#if orientation === "horizontal" || orientation === "vertical"}
	<ScrollArea
		class={cn("w-full", className)}
		orientation={orientation}
		{scrollbarXClasses}
		{scrollbarYClasses}
		{...restProps}
	>
		<div class={containerClasses}>
			{@render children()}
		</div>
	</ScrollArea>
{:else}
	<div class={containerClasses} {...restProps}>
		{@render children()}
	</div>
{/if}

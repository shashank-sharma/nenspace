<script lang="ts">
	import { cn } from "$lib/utils";
	import { Badge } from "$lib/components/ui/badge";
	import type { Snippet } from "svelte";

	type ChainOfThoughtSearchResultProps = {
		children: Snippet;
		class?: string;
	};

	let {
		children,
		class: className,
		...restProps
	}: ChainOfThoughtSearchResultProps = $props();
</script>

<Badge variant="secondary" class={cn("text-xs", className)} {...restProps}>
	{@render children()}
</Badge>

<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Command from "$lib/components/ui/command";
	import type { Snippet } from "svelte";

	type ModelSelectorListProps = {
		children: Snippet;
		class?: string;
	};

	let { children, class: className, ...restProps }: ModelSelectorListProps = $props();
</script>

<Command.List class={cn("max-h-[400px]", className)} {...restProps}>
	{@render children()}
</Command.List>

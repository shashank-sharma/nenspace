<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Command from "$lib/components/ui/command";
	import type { Snippet } from "svelte";

	type ModelSelectorGroupProps = {
		heading?: string;
		children: Snippet;
		class?: string;
	};

	let { heading, children, class: className, ...restProps }: ModelSelectorGroupProps = $props();
</script>

<Command.Group {heading} class={className} {...restProps}>
	{@render children()}
</Command.Group>

<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Command from "$lib/components/ui/command";
	import type { Snippet } from "svelte";

	type ModelSelectorItemProps = {
		value: string;
		onSelect?: () => void;
		children: Snippet;
		class?: string;
	};

	let {
		value,
		onSelect,
		children,
		class: className,
		...restProps
	}: ModelSelectorItemProps = $props();
</script>

<Command.Item {value} {onSelect} class={cn("cursor-pointer", className)} {...restProps}>
	{@render children()}
</Command.Item>

<script lang="ts">
	import * as Card from "$lib/components/ui/card";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { setPlanState } from "./plan-context.svelte.ts";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		isStreaming?: boolean;
		defaultOpen?: boolean;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		class?: string;
		children?: Snippet;
	};

	let {
		isStreaming = false,
		defaultOpen = false,
		open = $bindable(defaultOpen),
		onOpenChange,
		class: className,
		children
	}: Props = $props();

	setPlanState({ isStreaming });

	function handleOpenChange(value: boolean) {
		open = value;
		onOpenChange?.(value);
	}
</script>

<Collapsible.Root {open} onOpenChange={handleOpenChange}>
	<Card.Root class={cn("", className)}>
		{#if children}
			{@render children()}
		{/if}
	</Card.Root>
</Collapsible.Root>

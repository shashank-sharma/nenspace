<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import type { Snippet } from "svelte";

	type ReasoningProps = {
		class?: string;
		isStreaming?: boolean;
		open?: boolean;
		defaultOpen?: boolean;
		onOpenChange?: (open: boolean) => void;
		duration?: number;
		children: Snippet;
	};

	let {
		class: className,
		isStreaming = false,
		open = $bindable(),
		defaultOpen = true,
		onOpenChange,
		duration = $bindable(0),
		children,
		...restProps
	}: ReasoningProps = $props();

	// Auto-open when streaming, close when done
	$effect(() => {
		if (isStreaming && open === undefined) {
			open = true;
		} else if (!isStreaming && open === true && defaultOpen === false) {
			open = false;
		}
	});

	let containerClasses = $derived(
		cn("rounded-lg border bg-muted/50 overflow-hidden", className)
	);
</script>

<Collapsible.Root 
	bind:open 
	{onOpenChange}
	class={containerClasses}
	{...restProps}
>
	{@render children()}
</Collapsible.Root>

<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { Brain, ChevronDown } from "lucide-svelte";
	import { getContext } from "svelte";
	import type { Snippet } from "svelte";

	type ReasoningTriggerProps = {
		class?: string;
		children?: Snippet;
		isStreaming?: boolean;
	};

	let {
		class: className,
		children,
		isStreaming = false,
		...restProps
	}: ReasoningTriggerProps = $props();

	let triggerClasses = $derived(
		cn(
			"flex w-full items-center justify-between p-3 text-sm font-medium transition-all hover:bg-muted/80",
			className
		)
	);
</script>

<Collapsible.Trigger class={triggerClasses} {...restProps}>
	{#if children}
		{@render children()}
	{:else}
		<div class="flex items-center gap-2">
			<Brain class={cn("h-4 w-4", isStreaming && "animate-pulse")} />
			<span>{isStreaming ? "Thinking..." : "View reasoning"}</span>
		</div>
		<ChevronDown class="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
	{/if}
</Collapsible.Trigger>

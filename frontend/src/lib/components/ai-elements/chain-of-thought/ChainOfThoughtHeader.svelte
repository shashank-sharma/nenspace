<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { Network, ChevronDown } from "lucide-svelte";
	import type { Snippet } from "svelte";

	type ChainOfThoughtHeaderProps = {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children, ...restProps }: ChainOfThoughtHeaderProps = $props();

	let headerClasses = $derived(
		cn(
			"flex w-full items-center justify-between p-4 text-sm font-medium transition-all hover:bg-muted/50",
			className
		)
	);
</script>

<Collapsible.Trigger class={headerClasses} {...restProps}>
	{#if children}
		{@render children()}
	{:else}
		<div class="flex items-center gap-2">
			<Network class="h-4 w-4" />
			<span>Chain of Thought</span>
		</div>
		<ChevronDown class="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
	{/if}
</Collapsible.Trigger>

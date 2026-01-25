<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { FileText, ChevronDown } from "lucide-svelte";
	import type { Snippet } from "svelte";

	type SourcesTriggerProps = {
		count?: number;
		class?: string;
		children?: Snippet;
	};

	let {
		count,
		class: className,
		children,
		...restProps
	}: SourcesTriggerProps = $props();

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
			<FileText class="h-4 w-4" />
			<span>Used {count || 0} {count === 1 ? 'source' : 'sources'}</span>
		</div>
		<ChevronDown class="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
	{/if}
</Collapsible.Trigger>

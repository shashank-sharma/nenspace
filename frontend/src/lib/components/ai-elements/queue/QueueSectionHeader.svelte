<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { ChevronDown } from "lucide-svelte";
	import { Badge } from "$lib/components/ui/badge";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		title: string;
		count?: number;
		class?: string;
		children?: Snippet;
	};

	let { title, count, class: className, children }: Props = $props();
</script>

<Collapsible.Trigger
	class={cn(
		"flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
		className
	)}
>
	{#if children}
		{@render children()}
	{:else}
		<div class="flex items-center gap-2">
			<span>{title}</span>
			{#if count !== undefined}
				<Badge variant="secondary" class="text-xs">{count}</Badge>
			{/if}
		</div>
		<ChevronDown
			size={16}
			class="transition-transform duration-200 data-[state=open]:rotate-180"
		/>
	{/if}
</Collapsible.Trigger>

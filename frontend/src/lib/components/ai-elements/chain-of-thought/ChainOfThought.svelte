<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type ChainOfThoughtProps = HTMLAttributes<HTMLDivElement> & {
		open?: boolean;
		defaultOpen?: boolean;
		onOpenChange?: (open: boolean) => void;
		children: Snippet;
	};

	let {
		open = $bindable(),
		defaultOpen = false,
		onOpenChange,
		children,
		class: className,
		...restProps
	}: ChainOfThoughtProps = $props();

	let containerClasses = $derived(
		cn("rounded-lg border bg-card overflow-hidden", className)
	);
</script>

<Collapsible.Root bind:open {onOpenChange} class={containerClasses} {...restProps}>
	{@render children()}
</Collapsible.Root>

<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import type { Snippet } from "svelte";

	type ToolProps = {
		class?: string;
		defaultOpen?: boolean;
		children: Snippet;
	};

	let {
		class: className,
		defaultOpen = false,
		children,
		...restProps
	}: ToolProps = $props();

	let containerClasses = $derived(
		cn("rounded-lg border bg-muted/50 overflow-hidden", className)
	);
</script>

<Collapsible.Root {defaultOpen} class={containerClasses} {...restProps}>
	{@render children()}
</Collapsible.Root>

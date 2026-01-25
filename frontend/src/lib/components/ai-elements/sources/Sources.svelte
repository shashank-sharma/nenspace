<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import type { Snippet } from "svelte";

	type SourcesProps = {
		class?: string;
		children: Snippet;
	};

	let { class: className, children, ...restProps }: SourcesProps = $props();

	let containerClasses = $derived(
		cn("rounded-lg border bg-muted/50 overflow-hidden", className)
	);
</script>

<Collapsible.Root class={containerClasses} {...restProps}>
	{@render children()}
</Collapsible.Root>

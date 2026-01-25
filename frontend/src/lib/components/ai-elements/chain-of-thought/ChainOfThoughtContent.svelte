<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import type { Snippet } from "svelte";

	type ChainOfThoughtContentProps = {
		class?: string;
		children: Snippet;
	};

	let { class: className, children, ...restProps }: ChainOfThoughtContentProps = $props();

	let contentClasses = $derived(cn("px-4 pb-4 pt-0 space-y-4", className));
</script>

<Collapsible.Content class={contentClasses} {...restProps}>
	{@render children()}
</Collapsible.Content>

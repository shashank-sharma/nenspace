<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import type { Snippet } from "svelte";

	type ToolContentProps = {
		class?: string;
		children: Snippet;
	};

	let { class: className, children, ...restProps }: ToolContentProps = $props();

	let contentClasses = $derived(
		cn("px-3 pb-3 pt-0 space-y-3 text-sm", className)
	);
</script>

<Collapsible.Content class={contentClasses} {...restProps}>
	{@render children()}
</Collapsible.Content>

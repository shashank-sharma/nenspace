<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import type { Snippet } from "svelte";

	type SourcesContentProps = {
		class?: string;
		children: Snippet;
	};

	let { class: className, children, ...restProps }: SourcesContentProps = $props();

	let contentClasses = $derived(
		cn("px-3 pb-3 pt-0 space-y-2", className)
	);
</script>

<Collapsible.Content class={contentClasses} {...restProps}>
	{@render children()}
</Collapsible.Content>

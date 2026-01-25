<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import type { Snippet } from "svelte";

	type ReasoningContentProps = {
		class?: string;
		children: Snippet;
	};

	let { class: className, children, ...restProps }: ReasoningContentProps = $props();

	let contentClasses = $derived(
		cn("px-3 pb-3 pt-0 text-sm text-muted-foreground", className)
	);
</script>

<Collapsible.Content class={contentClasses} {...restProps}>
	{@render children()}
</Collapsible.Content>

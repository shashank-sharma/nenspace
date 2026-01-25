<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children, ...restProps }: Props = $props();
</script>

<Collapsible.Content class={cn("space-y-2 px-3 pb-2", className)} {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</Collapsible.Content>

<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible";
	import * as Card from "$lib/components/ui/card";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children }: Props = $props();
</script>

<Collapsible.Content>
	<Card.Content class={cn("pt-4", className)}>
		{#if children}
			{@render children()}
		{/if}
	</Card.Content>
</Collapsible.Content>

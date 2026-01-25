<script lang="ts">
	import * as Card from "$lib/components/ui/card";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children }: Props = $props();
</script>

<Card.Header class={cn("", className)}>
	{#if children}
		{@render children()}
	{/if}
</Card.Header>

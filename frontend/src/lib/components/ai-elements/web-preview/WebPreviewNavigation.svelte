<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children }: Props = $props();
</script>

<div class={cn("flex items-center gap-2 p-2 border-b bg-muted/50", className)}>
	{#if children}
		{@render children()}
	{/if}
</div>

<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children }: Props = $props();
</script>

<div class={cn("text-xs text-muted-foreground", className)}>
	{#if children}
		{@render children()}
	{/if}
</div>

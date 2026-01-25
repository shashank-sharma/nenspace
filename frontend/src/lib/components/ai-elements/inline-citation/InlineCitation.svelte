<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	type Props = HTMLAttributes<HTMLSpanElement> & {
		children?: Snippet;
		class?: string;
	};

	let { children, class: className, ...restProps }: Props = $props();
</script>

<span class={cn("inline-flex items-baseline gap-1", className)} {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</span>

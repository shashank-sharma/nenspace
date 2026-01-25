<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import type { HTMLLiAttributes } from "svelte/elements";

	type Props = HTMLLiAttributes & {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children, ...restProps }: Props = $props();
</script>

<li
	class={cn(
		"group flex items-start gap-2 rounded-md p-2 text-sm hover:bg-accent transition-colors",
		className
	)}
	{...restProps}
>
	{#if children}
		{@render children()}
	{/if}
</li>

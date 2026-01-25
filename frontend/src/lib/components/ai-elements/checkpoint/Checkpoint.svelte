<script lang="ts">
	import { setContext } from "svelte";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	type Props = HTMLAttributes<HTMLDivElement> & {
		children?: Snippet;
		class?: string;
	};

	let { children, class: className, ...restProps }: Props = $props();

	const checkpointContext = {
		// Context for child components if needed
	};
	setContext("checkpoint", checkpointContext);
</script>

<div
	class={cn("flex items-center gap-2 py-3 relative group", className)}
	{...restProps}
>
	{#if children}
		{@render children()}
	{/if}
	<div
		class="flex-1 h-px bg-border ml-2"
		aria-hidden="true"
	></div>
</div>

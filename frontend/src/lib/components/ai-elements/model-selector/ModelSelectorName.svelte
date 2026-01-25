<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type ModelSelectorNameProps = HTMLAttributes<HTMLSpanElement> & {
		children: Snippet;
	};

	let { children, class: className, ...restProps }: ModelSelectorNameProps = $props();
</script>

<span class={cn("font-medium", className)} {...restProps}>
	{@render children()}
</span>

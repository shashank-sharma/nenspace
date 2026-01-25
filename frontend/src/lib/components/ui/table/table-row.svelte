<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type $$Props = HTMLAttributes<HTMLTableRowElement> & {
		"data-state"?: unknown;
		children?: Snippet;
	};

	let className: $$Props["class"] = undefined;
	let { children, class: _, ...restProps }: $$Props = $props();
	export { className as class };
</script>

<tr
	class={cn(
		"hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
		className
	)}
	{...restProps}
	on:click
	on:keydown
>
	{@render children?.()}
</tr>

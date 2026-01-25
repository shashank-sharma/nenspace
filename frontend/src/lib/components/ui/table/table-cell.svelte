<script lang="ts">
	import type { HTMLTdAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type $$Props = HTMLTdAttributes & {
		children?: Snippet;
	};

	let className: $$Props["class"] = undefined;
	let { children, class: _, ...restProps }: $$Props = $props();
	export { className as class };
</script>

<td
	class={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
	{...restProps}
	on:click
	on:keydown
>
	{@render children?.()}
</td>

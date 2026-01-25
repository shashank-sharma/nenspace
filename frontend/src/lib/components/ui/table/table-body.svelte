<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type $$Props = HTMLAttributes<HTMLTableSectionElement> & {
		children?: Snippet;
	};

	let className: $$Props["class"] = undefined;
	let { children, class: _, ...restProps }: $$Props = $props();
	export { className as class };
</script>

<tbody class={cn("[&_tr:last-child]:border-0", className)} {...restProps}>
	{@render children?.()}
</tbody>

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

<tfoot class={cn("bg-muted/50 text-primary-foreground font-medium", className)} {...restProps}>
	{@render children?.()}
</tfoot>

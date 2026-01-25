<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type $$Props = HTMLAttributes<HTMLTableCaptionElement> & {
		children?: Snippet;
	};

	let className: $$Props["class"] = undefined;
	let { children, class: _, ...restProps }: $$Props = $props();
	export { className as class };
</script>

<caption class={cn("text-muted-foreground mt-4 text-sm", className)} {...restProps}>
	{@render children?.()}
</caption>

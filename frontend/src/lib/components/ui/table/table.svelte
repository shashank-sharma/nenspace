<script lang="ts">
	import type { HTMLTableAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type $$Props = HTMLTableAttributes & {
		children?: Snippet;
	};

	let className: $$Props["class"] = undefined;
	let { children, class: _, ...restProps }: $$Props = $props();
	export { className as class };
</script>

<div class="relative w-full overflow-auto">
	<table class={cn("w-full caption-bottom text-sm", className)} {...restProps}>
		{@render children?.()}
	</table>
</div>

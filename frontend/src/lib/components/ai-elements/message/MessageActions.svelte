<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	export type MessageActionsProps = HTMLAttributes<HTMLDivElement>;

	let { class: className, children, ...restProps }: MessageActionsProps = $props();
</script>

<div class={cn("flex items-center gap-1 mt-2", className)} {...restProps}>
	{@render children?.()}
</div>

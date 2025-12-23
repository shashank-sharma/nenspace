<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	type $$Props = HTMLAttributes<HTMLDivElement>;

	let className: $$Props["class"] = undefined;
	export { className as class };
</script>

<div
	class={cn(
		"bg-card text-card-foreground rounded-lg border-2 border-border shadow-sm",
		"relative overflow-visible",
		// Corner highlights using pseudo-elements - theme-aware borders (darker, no opacity)
		// Light mode: darker foreground color, Dark mode: white highlight
		"before:absolute before:top-0 before:left-0 before:w-4 before:h-4 before:border-t-2 before:border-l-2 before:border-foreground dark:before:border-white before:rounded-tl-lg before:pointer-events-none before:z-30",
		"after:absolute after:top-0 after:right-0 after:w-4 after:h-4 after:border-t-2 after:border-r-2 after:border-foreground dark:after:border-white after:rounded-tr-lg after:pointer-events-none after:z-30",
		className
	)}
	{...$$restProps}
>
	<slot />
	<!-- Bottom corner highlights - theme-aware borders (darker, no opacity) -->
	<span class="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-foreground dark:border-white rounded-bl-lg pointer-events-none z-30"></span>
	<span class="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-foreground dark:border-white rounded-br-lg pointer-events-none z-30"></span>
</div>

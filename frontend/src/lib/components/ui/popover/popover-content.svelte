<script lang="ts">
	import { Popover as PopoverPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";
	import Portal from "./popover-portal.svelte";

	type $$Props = PopoverPrimitive.ContentProps;
	let className: $$Props["class"] = undefined;
	export { className as class };
</script>

<!-- According to Bits UI migration guide, Popover.Content should be wrapped in Popover.Portal -->
<Portal>
	<PopoverPrimitive.Content
		class={cn(
			"bg-popover text-popover-foreground z-50 w-72 rounded-md border p-4 shadow-md outline-none",
			className
		)}
		{...$$restProps}
	>
		<slot />
	</PopoverPrimitive.Content>
</Portal>

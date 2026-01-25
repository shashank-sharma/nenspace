<script lang="ts">
	import { cn } from "$lib/utils";
	import { Button, type ButtonProps } from "$lib/components/ui/button";
	import type { Snippet } from "svelte";
	import * as Dialog from "$lib/components/ui/dialog";

	type ModelSelectorTriggerProps = ButtonProps & {
		children?: Snippet;
	};

	let {
		children,
		variant = "outline",
		class: className,
		...restProps
	}: ModelSelectorTriggerProps = $props();
</script>

<Dialog.Trigger>
	<Button {variant} class={cn("justify-start", className)} {...restProps}>
		{#if children}
			{@render children()}
		{/if}
	</Button>
</Dialog.Trigger>

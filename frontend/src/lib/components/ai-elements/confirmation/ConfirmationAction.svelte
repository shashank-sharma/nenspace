<script lang="ts">
	import { cn } from "$lib/utils";
	import { Button, type ButtonProps } from "$lib/components/ui/button";
	import type { Snippet } from "svelte";

	type ConfirmationActionProps = ButtonProps & {
		children: Snippet;
	};

	let {
		children,
		variant = "default",
		size = "sm",
		class: className,
		...restProps
	}: ConfirmationActionProps = $props();
</script>

<Button {variant} {size} class={className} {...restProps}>
	{@render children()}
</Button>

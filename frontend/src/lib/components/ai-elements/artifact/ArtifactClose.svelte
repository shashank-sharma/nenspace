<script lang="ts">
	import { cn } from "$lib/utils";
	import { Button, type ButtonProps } from "$lib/components/ui/button";
	import { X } from "lucide-svelte";
	import type { Snippet } from "svelte";

	type ArtifactCloseProps = ButtonProps & {
		children?: Snippet;
	};

	let {
		children,
		variant = "ghost",
		size = "sm",
		class: className,
		...restProps
	}: ArtifactCloseProps = $props();

	let buttonClasses = $derived(cn("h-8 w-8 p-0", className));
</script>

<Button {variant} {size} class={buttonClasses} {...restProps}>
	{#if children}
		{@render children()}
	{:else}
		<X class="h-4 w-4" />
		<span class="sr-only">Close</span>
	{/if}
</Button>

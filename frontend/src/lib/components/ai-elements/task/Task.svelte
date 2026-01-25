<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		open?: boolean;
		class?: string;
		children?: Snippet;
	};

	let { open = $bindable(true), class: className, children, ...restProps }: Props = $props();
</script>

<Collapsible.Root bind:open class={cn("space-y-2", className)} {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</Collapsible.Root>

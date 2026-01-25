<script lang="ts">
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		align?: "start" | "center" | "end";
		preventScroll?: boolean;
		children?: Snippet;
	};

	let { class: className, align = "start", preventScroll = true, children }: Props = $props();
</script>

<DropdownMenu.Content {align} class={cn("w-56", className)}>
	{#if children}
		{@render children()}
	{/if}
</DropdownMenu.Content>

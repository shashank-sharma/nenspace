<script lang="ts">
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		onclick?: () => void;
		children?: Snippet;
	};

	let { class: className, onclick, children }: Props = $props();
</script>

<DropdownMenu.Item {onclick} class={cn("cursor-pointer", className)}>
	{#if children}
		{@render children()}
	{/if}
</DropdownMenu.Item>

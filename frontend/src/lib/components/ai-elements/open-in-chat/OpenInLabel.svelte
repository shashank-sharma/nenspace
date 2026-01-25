<script lang="ts">
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children }: Props = $props();
</script>

<DropdownMenu.Label class={cn("", className)}>
	{#if children}
		{@render children()}
	{/if}
</DropdownMenu.Label>

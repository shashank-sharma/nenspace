<script lang="ts">
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { setOpenInState } from "./open-in-context.svelte.ts";
	import type { Snippet } from "svelte";

	type Props = {
		query: string;
		children?: Snippet;
	};

	let { query, children }: Props = $props();

	setOpenInState({ query });
</script>

<DropdownMenu.Root>
	{#if children}
		{@render children()}
	{/if}
</DropdownMenu.Root>

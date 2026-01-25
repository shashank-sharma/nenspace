<script lang="ts">
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { Button } from "$lib/components/ui/button";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children }: Props = $props();
</script>

<DropdownMenu.Trigger asChild let:builder>
	<Button builders={[builder]} variant="outline" size="sm" class={cn("", className)}>
		{#if children}
			{@render children()}
		{:else}
			Open in chat
		{/if}
	</Button>
</DropdownMenu.Trigger>

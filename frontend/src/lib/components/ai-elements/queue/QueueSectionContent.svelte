<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children }: Props = $props();
</script>

<Collapsible.Content>
	<ScrollArea class={cn("max-h-[300px]", className)}>
		<ul class="space-y-1 px-3 py-2">
			{#if children}
				{@render children()}
			{/if}
		</ul>
	</ScrollArea>
</Collapsible.Content>

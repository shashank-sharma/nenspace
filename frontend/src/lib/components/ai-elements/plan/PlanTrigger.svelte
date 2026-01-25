<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { Button } from "$lib/components/ui/button";
	import { ChevronDown } from "lucide-svelte";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children }: Props = $props();
</script>

<Collapsible.Trigger asChild let:builder>
	<Button builders={[builder]} variant="ghost" size="sm" class={cn("", className)}>
		{#if children}
			{@render children()}
		{:else}
			Toggle plan
			<ChevronDown class="ml-2 h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
		{/if}
	</Button>
</Collapsible.Trigger>

<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { Button } from "$lib/components/ui/button";
	import { ChevronDown } from "lucide-svelte";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		defaultOpen?: boolean;
		class?: string;
		children?: Snippet;
	};

	let { defaultOpen = true, class: className, children, ...restProps }: Props = $props();
</script>

<Collapsible.Root {defaultOpen} class={cn("space-y-2", className)} {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</Collapsible.Root>

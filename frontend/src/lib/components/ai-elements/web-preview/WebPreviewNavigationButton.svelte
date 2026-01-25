<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Tooltip from "$lib/components/ui/tooltip";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		onclick?: (event: MouseEvent) => void;
		disabled?: boolean;
		tooltip?: string;
		class?: string;
		children?: Snippet;
	};

	let { onclick, disabled, tooltip, class: className, children }: Props = $props();
</script>

{#if tooltip}
	<Tooltip.Root>
		<Tooltip.Trigger asChild let:builder>
			<Button
				builders={[builder]}
				variant="ghost"
				size="icon"
				class={cn("h-8 w-8", className)}
				{onclick}
				{disabled}
			>
				{#if children}
					{@render children()}
				{/if}
			</Button>
		</Tooltip.Trigger>
		<Tooltip.Content>
			<p>{tooltip}</p>
		</Tooltip.Content>
	</Tooltip.Root>
{:else}
	<Button variant="ghost" size="icon" class={cn("h-8 w-8", className)} {onclick} {disabled}>
		{#if children}
			{@render children()}
		{/if}
	</Button>
{/if}

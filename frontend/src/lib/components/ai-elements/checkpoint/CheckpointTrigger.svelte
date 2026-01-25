<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Tooltip from "$lib/components/ui/tooltip";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		children?: Snippet;
		class?: string;
		variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
		size?: "default" | "sm" | "lg" | "icon";
		tooltip?: string;
		onclick?: (e: MouseEvent) => void;
		disabled?: boolean;
	};

	let {
		children,
		class: className,
		variant = "ghost",
		size = "sm",
		tooltip,
		onclick,
		disabled = false,
		...restProps
	}: Props = $props();
</script>

{#if tooltip}
	<Tooltip.Root>
		<Tooltip.Trigger asChild let:builder>
			<Button
				builders={[builder]}
				{variant}
				{size}
				{onclick}
				{disabled}
				class={cn("h-auto px-2 py-1 text-xs", className)}
				{...restProps}
			>
				{#if children}
					{@render children()}
				{:else}
					Restore checkpoint
				{/if}
			</Button>
		</Tooltip.Trigger>
		<Tooltip.Content>
			<p>{tooltip}</p>
		</Tooltip.Content>
	</Tooltip.Root>
{:else}
	<Button
		{variant}
		{size}
		{onclick}
		{disabled}
		class={cn("h-auto px-2 py-1 text-xs", className)}
		{...restProps}
	>
		{#if children}
			{@render children()}
		{:else}
			Restore checkpoint
		{/if}
	</Button>
{/if}

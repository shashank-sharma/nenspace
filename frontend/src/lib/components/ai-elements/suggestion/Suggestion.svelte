<script lang="ts">
	import { cn } from "$lib/utils";
	import { Button, type ButtonProps } from "$lib/components/ui/button";
	import type { Snippet } from "svelte";

	type SuggestionProps = ButtonProps & {
		suggestion: string;
		onclick: (suggestion: string) => void;
		children?: Snippet;
	};

	let {
		suggestion,
		onclick,
		children,
		variant = "outline",
		size = "sm",
		class: className,
		...restProps
	}: SuggestionProps = $props();

	function handleClick() {
		onclick(suggestion);
	}

	let buttonClasses = $derived(
		cn(
			"whitespace-nowrap text-left hover:bg-accent hover:text-accent-foreground",
			className
		)
	);
</script>

<Button
	type="button"
	{variant}
	{size}
	class={buttonClasses}
	onclick={handleClick}
	{...restProps}
>
	{#if children}
		{@render children()}
	{:else}
		{suggestion}
	{/if}
</Button>

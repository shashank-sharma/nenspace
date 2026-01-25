<script lang="ts">
	import { cn } from "$lib/utils";
	import { ExternalLink } from "lucide-svelte";
	import type { HTMLAnchorAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type SourceProps = HTMLAnchorAttributes & {
		href: string;
		title: string;
		children?: Snippet;
	};

	let {
		href,
		title,
		children,
		class: className,
		...restProps
	}: SourceProps = $props();

	let linkClasses = $derived(
		cn(
			"flex items-start gap-2 rounded-md border bg-card p-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
			className
		)
	);
</script>

<a
	{href}
	target="_blank"
	rel="noopener noreferrer"
	class={linkClasses}
	{...restProps}
>
	{#if children}
		{@render children()}
	{:else}
		<ExternalLink class="h-4 w-4 mt-0.5 flex-shrink-0" />
		<span class="flex-1 break-words">{title}</span>
	{/if}
</a>

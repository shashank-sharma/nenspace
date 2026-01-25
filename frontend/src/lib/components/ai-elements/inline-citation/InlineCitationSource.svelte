<script lang="ts">
	import { ExternalLink } from "lucide-svelte";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import type { InlineCitationSource } from "./inline-citation-context.svelte.ts";

	type Props = {
		source: InlineCitationSource;
		class?: string;
		children?: Snippet;
	};

	let { source, class: className, children }: Props = $props();
</script>

<div class={cn("space-y-2", className)}>
	{#if children}
		{@render children()}
	{:else}
		<div class="space-y-1">
			<a
				href={source.url}
				target="_blank"
				rel="noopener noreferrer"
				class="text-sm font-medium hover:underline flex items-center gap-1"
			>
				{source.title}
				<ExternalLink size={12} />
			</a>
			{#if source.description}
				<p class="text-xs text-muted-foreground">{source.description}</p>
			{/if}
		</div>
		{#if source.quote}
			<blockquote class="border-l-2 border-border pl-3 text-xs italic text-muted-foreground">
				{source.quote}
			</blockquote>
		{/if}
	{/if}
</div>

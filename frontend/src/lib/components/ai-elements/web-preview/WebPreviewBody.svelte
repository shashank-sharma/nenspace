<script lang="ts">
	import { getWebPreviewState } from "./web-preview-context.svelte.ts";
	import { Loader } from "$lib/components/ai-elements/loader";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		src?: string;
		loading?: Snippet;
		class?: string;
	};

	let { src, loading, class: className }: Props = $props();

	const state = getWebPreviewState();
	const iframeSrc = $derived(src ?? state.url);
	let isLoading = $state(true);
</script>

<div class={cn("relative flex-1 bg-background", className)}>
	{#if isLoading}
		<div class="absolute inset-0 flex items-center justify-center bg-muted/50">
			{#if loading}
				{@render loading()}
			{:else}
				<Loader size={32} />
			{/if}
		</div>
	{/if}
	{#if iframeSrc}
		<iframe
			{src}
			title="Web Preview"
			class="w-full h-full"
			onload={() => (isLoading = false)}
			sandbox="allow-scripts allow-same-origin"
		></iframe>
	{/if}
</div>

<script lang="ts">
	import { setWebPreviewState } from "./web-preview-context.svelte.ts";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		defaultUrl?: string;
		onUrlChange?: (url: string) => void;
		class?: string;
		children?: Snippet;
	};

	let { defaultUrl = "", onUrlChange, class: className, children }: Props = $props();

	let url = $state(defaultUrl);

	function setUrl(newUrl: string) {
		url = newUrl;
		onUrlChange?.(newUrl);
	}

	setWebPreviewState({ url, setUrl });
</script>

<div class={cn("flex flex-col h-full border rounded-lg overflow-hidden", className)}>
	{#if children}
		{@render children()}
	{/if}
</div>

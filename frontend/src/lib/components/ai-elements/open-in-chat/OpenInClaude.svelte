<script lang="ts">
	import OpenInItem from "./OpenInItem.svelte";
	import { getOpenInState } from "./open-in-context.svelte.ts";
	import { cn } from "$lib/utils";

	type Props = {
		class?: string;
	};

	let { class: className }: Props = $props();

	const state = getOpenInState();

	function openClaude() {
		const url = `https://claude.ai/new?q=${encodeURIComponent(state.query)}`;
		window.open(url, "_blank");
	}
</script>

<OpenInItem onclick={openClaude} class={cn("", className)}>
	<span>Claude</span>
</OpenInItem>

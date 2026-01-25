<script lang="ts">
	import OpenInItem from "./OpenInItem.svelte";
	import { getOpenInState } from "./open-in-context.svelte.ts";
	import { cn } from "$lib/utils";

	type Props = {
		class?: string;
	};

	let { class: className }: Props = $props();

	const state = getOpenInState();

	function openV0() {
		const url = `https://v0.dev/chat?q=${encodeURIComponent(state.query)}`;
		window.open(url, "_blank");
	}
</script>

<OpenInItem onclick={openV0} class={cn("", className)}>
	<span>v0</span>
</OpenInItem>

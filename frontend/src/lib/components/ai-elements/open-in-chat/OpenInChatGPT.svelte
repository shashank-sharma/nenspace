<script lang="ts">
	import OpenInItem from "./OpenInItem.svelte";
	import { getOpenInState } from "./open-in-context.svelte.ts";
	import { cn } from "$lib/utils";

	type Props = {
		class?: string;
	};

	let { class: className }: Props = $props();

	const state = getOpenInState();

	function openChatGPT() {
		const url = `https://chat.openai.com/?q=${encodeURIComponent(state.query)}`;
		window.open(url, "_blank");
	}
</script>

<OpenInItem onclick={openChatGPT} class={cn("", className)}>
	<span>ChatGPT</span>
</OpenInItem>

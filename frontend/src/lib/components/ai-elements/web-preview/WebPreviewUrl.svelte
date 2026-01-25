<script lang="ts">
	import { Input } from "$lib/components/ui/input";
	import { getWebPreviewState } from "./web-preview-context.svelte.ts";
	import { cn } from "$lib/utils";

	type Props = {
		value?: string;
		onchange?: (event: Event) => void;
		onkeydown?: (event: KeyboardEvent) => void;
		class?: string;
	};

	let { value = $bindable(""), onchange, onkeydown, class: className }: Props = $props();

	const state = getWebPreviewState();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			state.setUrl(value);
		}
		onkeydown?.(e);
	}
</script>

<Input
	type="url"
	bind:value
	placeholder="Enter URL..."
	class={cn("flex-1", className)}
	{onchange}
	onkeydown={handleKeydown}
/>

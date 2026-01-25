<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLImgAttributes } from "svelte/elements";

	type Props = HTMLImgAttributes & {
		base64: string;
		uint8Array?: Uint8Array;
		mediaType?: string;
		alt?: string;
		class?: string;
		ref?: HTMLImageElement | null;
	};

	let {
		base64,
		uint8Array,
		mediaType = "image/png",
		alt = "AI generated image",
		class: className,
		ref = $bindable(null),
		...restProps
	}: Props = $props();

	const dataUrl = $derived(`data:${mediaType};base64,${base64}`);
</script>

<img
	bind:this={ref}
	src={dataUrl}
	{alt}
	class={cn("h-auto max-w-full overflow-hidden rounded-md", className)}
	{...restProps}
/>

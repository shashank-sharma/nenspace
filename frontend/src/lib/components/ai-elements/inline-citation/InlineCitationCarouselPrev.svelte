<script lang="ts">
	import * as Carousel from "$lib/components/ui/carousel";
	import { cn } from "$lib/utils";
	import type { HTMLButtonAttributes } from "svelte/elements";

	type Props = HTMLButtonAttributes & {
		class?: string;
	};

	let { class: className, ...restProps }: Props = $props();
</script>

<Carousel.Previous class={cn("", className)} {...restProps} />

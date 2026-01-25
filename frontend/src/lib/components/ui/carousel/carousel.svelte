<script lang="ts" context="module">
	import type { EmblaCarouselType, EmblaOptionsType, EmblaPluginType } from 'embla-carousel';
	import emblaCarouselSvelte from 'embla-carousel-svelte';

	export type CarouselAPI = EmblaCarouselType;
	export type CarouselOptions = EmblaOptionsType;
	export type CarouselPlugin = EmblaPluginType;
</script>

<script lang="ts">
	import { cn } from '$lib/utils';
	import { setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement> & {
		opts?: CarouselOptions;
		plugins?: CarouselPlugin[];
		orientation?: 'horizontal' | 'vertical';
		children?: Snippet;
		class?: string;
	};

	let {
		opts = {},
		plugins = [],
		orientation = 'horizontal',
		children,
		class: className,
		...restProps
	}: Props = $props();

	let emblaNode = $state<HTMLDivElement>();
	let emblaApi = $state<CarouselAPI>();

	$effect(() => {
		if (emblaNode) {
			const [emblaRef, emblaApiInstance] = emblaCarouselSvelte(
				{ ...opts, axis: orientation === 'horizontal' ? 'x' : 'y' },
				plugins
			);
			emblaRef(emblaNode);
			emblaApi = emblaApiInstance();
		}
	});

	setContext('carousel', {
		api: () => emblaApi,
		orientation: () => orientation
	});
</script>

<div
	bind:this={emblaNode}
	class={cn('relative', className)}
	role="region"
	aria-roledescription="carousel"
	{...restProps}
>
	{#if children}
		{@render children()}
	{/if}
</div>

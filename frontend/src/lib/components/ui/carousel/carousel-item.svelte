<script lang="ts">
	import { cn } from '$lib/utils';
	import { getContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement> & {
		children?: Snippet;
		class?: string;
	};

	let { children, class: className, ...restProps }: Props = $props();

	const { orientation } = getContext<any>('carousel');
	const isVertical = $derived(orientation() === 'vertical');
</script>

<div
	class={cn('flex', isVertical ? 'flex-col' : '', className)}
	{...restProps}
>
	{#if children}
		{@render children()}
	{/if}
</div>

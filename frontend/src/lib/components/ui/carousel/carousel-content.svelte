<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLDivElement> & {
		children?: Snippet;
		class?: string;
	};

	let { children, class: className, ...restProps }: Props = $props();
</script>

<div class={cn('overflow-hidden', className)} {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</div>

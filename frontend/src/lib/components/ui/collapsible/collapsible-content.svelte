<script lang="ts">
	import { Collapsible as CollapsiblePrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	type Props = CollapsiblePrimitive.ContentProps & {
		children?: Snippet;
		class?: string;
	};

	let { children, class: className, ...restProps }: Props = $props();
</script>

<CollapsiblePrimitive.Content class={cn('overflow-hidden', className)} {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</CollapsiblePrimitive.Content>

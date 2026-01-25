<script lang="ts" context="module">
	import { type ComponentProps } from 'svelte';
	import type Collapsible from './collapsible.svelte';

	export type RootProps = ComponentProps<Collapsible>;
</script>

<script lang="ts">
	import { Collapsible as CollapsiblePrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';

	type Props = CollapsiblePrimitive.Props & {
		children?: Snippet;
	};

	let { children, ...restProps }: Props = $props();
</script>

<CollapsiblePrimitive.Root {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</CollapsiblePrimitive.Root>

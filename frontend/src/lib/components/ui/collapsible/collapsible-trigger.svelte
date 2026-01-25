<script lang="ts">
	import { Collapsible as CollapsiblePrimitive } from 'bits-ui';
	import type { Snippet } from 'svelte';

	type Props = CollapsiblePrimitive.TriggerProps & {
		children?: Snippet;
	};

	let { children, ...restProps }: Props = $props();
</script>

<CollapsiblePrimitive.Trigger {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</CollapsiblePrimitive.Trigger>

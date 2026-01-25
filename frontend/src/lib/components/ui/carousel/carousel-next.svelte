<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { getContext } from 'svelte';
	import { ArrowRight } from 'lucide-svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		class?: string;
	};

	let { class: className, ...restProps }: Props = $props();

	const { api } = getContext<any>('carousel');

	function scrollNext() {
		api()?.scrollNext();
	}

	const canScrollNext = $derived(api()?.canScrollNext() ?? false);
</script>

<Button
	variant="outline"
	size="icon"
	class={cn('h-8 w-8 rounded-full', className)}
	disabled={!canScrollNext}
	onclick={scrollNext}
	{...restProps}
>
	<ArrowRight class="h-4 w-4" />
	<span class="sr-only">Next slide</span>
</Button>

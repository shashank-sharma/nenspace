<script lang="ts">
	import { cn } from "$lib/utils";
	import { Button } from "$lib/components/ui/button";
	import { ChevronDown, ChevronUp } from "lucide-svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type CodeOverflowProps = HTMLAttributes<HTMLDivElement> & {
		collapsed?: boolean;
		maxHeight?: number;
		children?: Snippet;
	};

	let {
		collapsed = $bindable(true),
		maxHeight = 400,
		class: className,
		children,
		...restProps
	}: CodeOverflowProps = $props();

	let contentHeight = $state(0);
	let contentRef = $state<HTMLDivElement | null>(null);

	let shouldShowToggle = $derived(contentHeight > maxHeight);

	$effect(() => {
		if (contentRef) {
			contentHeight = contentRef.scrollHeight;
		}
	});

	let containerClasses = $derived(
		cn("relative overflow-hidden transition-all duration-300", className)
	);

	let contentStyle = $derived(
		collapsed && shouldShowToggle ? `max-height: ${maxHeight}px;` : ""
	);
</script>

<div class={containerClasses} {...restProps}>
	<div bind:this={contentRef} style={contentStyle} class="overflow-hidden">
		{#if children}
			{@render children()}
		{/if}
	</div>

	{#if shouldShowToggle}
		<div
			class={cn(
				"absolute bottom-0 left-0 right-0 flex items-end justify-center bg-gradient-to-t from-background to-transparent pb-2 pt-8",
				collapsed ? "opacity-100" : "opacity-0"
			)}
		>
			<Button
				variant="outline"
				size="sm"
				onclick={() => (collapsed = !collapsed)}
				class="shadow-lg"
			>
				{#if collapsed}
					<ChevronDown class="mr-2 h-4 w-4" />
					Show more
				{:else}
					<ChevronUp class="mr-2 h-4 w-4" />
					Show less
				{/if}
			</Button>
		</div>
	{/if}
</div>

<script lang="ts">
	import { Bookmark } from "lucide-svelte";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	type Props = HTMLAttributes<HTMLDivElement> & {
		children?: Snippet;
		class?: string;
		size?: number;
	};

	let { children, class: className, size = 16, ...restProps }: Props = $props();
</script>

<div
	class={cn("flex items-center justify-center text-muted-foreground", className)}
	{...restProps}
>
	{#if children}
		{@render children()}
	{:else}
		<Bookmark class="fill-current" size={size} />
	{/if}
</div>

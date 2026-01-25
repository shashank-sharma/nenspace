<script lang="ts">
	import { Badge } from "$lib/components/ui/badge";
	import { FileCode } from "lucide-svelte";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";

	type Props = HTMLAttributes<HTMLDivElement> & {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children, ...restProps }: Props = $props();
</script>

<Badge variant="secondary" class={cn("gap-1 text-xs", className)} {...restProps}>
	<FileCode size={12} />
	{#if children}
		{@render children()}
	{/if}
</Badge>

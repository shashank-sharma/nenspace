<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type ArtifactHeaderProps = HTMLAttributes<HTMLDivElement> & {
		children: Snippet;
	};

	let { children, class: className, ...restProps }: ArtifactHeaderProps = $props();

	let headerClasses = $derived(
		cn("flex items-center justify-between border-b bg-muted/50 p-4", className)
	);
</script>

<div class={headerClasses} {...restProps}>
	{@render children()}
</div>

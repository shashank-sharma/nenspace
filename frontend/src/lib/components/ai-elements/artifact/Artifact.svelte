<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type ArtifactProps = HTMLAttributes<HTMLDivElement> & {
		children: Snippet;
	};

	let { children, class: className, ...restProps }: ArtifactProps = $props();

	let containerClasses = $derived(
		cn("rounded-lg border bg-card overflow-hidden", className)
	);
</script>

<div class={containerClasses} {...restProps}>
	{@render children()}
</div>

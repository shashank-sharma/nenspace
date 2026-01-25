<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type ArtifactContentProps = HTMLAttributes<HTMLDivElement> & {
		children: Snippet;
	};

	let { children, class: className, ...restProps }: ArtifactContentProps = $props();

	let contentClasses = $derived(cn("p-4", className));
</script>

<div class={contentClasses} {...restProps}>
	{@render children()}
</div>

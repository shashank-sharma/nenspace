<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type ArtifactDescriptionProps = HTMLAttributes<HTMLParagraphElement> & {
		children: Snippet;
	};

	let { children, class: className, ...restProps }: ArtifactDescriptionProps = $props();

	let descriptionClasses = $derived(
		cn("text-xs text-muted-foreground", className)
	);
</script>

<p class={descriptionClasses} {...restProps}>
	{@render children()}
</p>

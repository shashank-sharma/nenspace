<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type ArtifactTitleProps = HTMLAttributes<HTMLParagraphElement> & {
		children: Snippet;
	};

	let { children, class: className, ...restProps }: ArtifactTitleProps = $props();

	let titleClasses = $derived(cn("font-semibold text-sm", className));
</script>

<p class={titleClasses} {...restProps}>
	{@render children()}
</p>

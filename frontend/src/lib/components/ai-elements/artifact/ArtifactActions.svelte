<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type ArtifactActionsProps = HTMLAttributes<HTMLDivElement> & {
		children: Snippet;
	};

	let { children, class: className, ...restProps }: ArtifactActionsProps = $props();

	let actionsClasses = $derived(cn("flex items-center gap-1", className));
</script>

<div class={actionsClasses} {...restProps}>
	{@render children()}
</div>

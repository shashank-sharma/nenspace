<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type ConfirmationActionsProps = HTMLAttributes<HTMLDivElement> & {
		children: Snippet;
	};

	let { children, class: className, ...restProps }: ConfirmationActionsProps = $props();

	let actionsClasses = $derived(cn("mt-4 flex items-center gap-2", className));
</script>

<div class={actionsClasses} {...restProps}>
	{@render children()}
</div>

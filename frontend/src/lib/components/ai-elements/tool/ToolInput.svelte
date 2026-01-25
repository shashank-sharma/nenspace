<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	type ToolInputProps = HTMLAttributes<HTMLDivElement> & {
		input: any;
	};

	let { input, class: className, ...restProps }: ToolInputProps = $props();

	let contentClasses = $derived(cn("space-y-2", className));
</script>

<div class={contentClasses} {...restProps}>
	<h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parameters</h4>
	<pre class="rounded-md bg-muted p-3 text-xs overflow-x-auto"><code>{JSON.stringify(input, null, 2)}</code></pre>
</div>

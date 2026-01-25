<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type ToolOutputProps = HTMLAttributes<HTMLDivElement> & {
		output?: any;
		errorText?: string;
		children?: Snippet;
	};

	let {
		output,
		errorText,
		children,
		class: className,
		...restProps
	}: ToolOutputProps = $props();

	let contentClasses = $derived(cn("space-y-2", className));
</script>

<div class={contentClasses} {...restProps}>
	{#if children}
		{@render children()}
	{:else if errorText}
		<div>
			<h4 class="text-xs font-semibold text-destructive uppercase tracking-wide mb-2">Error</h4>
			<div class="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
				{errorText}
			</div>
		</div>
	{:else if output}
		<div>
			<h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Result</h4>
			<pre class="rounded-md bg-muted p-3 text-xs overflow-x-auto"><code>{typeof output === 'string' ? output : JSON.stringify(output, null, 2)}</code></pre>
		</div>
	{/if}
</div>

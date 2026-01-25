<script lang="ts">
	import { XCircle } from "lucide-svelte";
	import type { Snippet } from "svelte";

	type ConfirmationRejectedProps = {
		children?: Snippet;
	};

	let { children }: ConfirmationRejectedProps = $props();
</script>

<div class="flex items-center gap-2 text-sm text-muted-foreground">
	<XCircle class="h-4 w-4 text-destructive" />
	{#if children}
		{@render children()}
	{:else}
		<span>You rejected this tool execution</span>
	{/if}
</div>

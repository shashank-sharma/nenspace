<script lang="ts">
	import { CheckCircle } from "lucide-svelte";
	import type { Snippet } from "svelte";

	type ConfirmationAcceptedProps = {
		children?: Snippet;
	};

	let { children }: ConfirmationAcceptedProps = $props();
</script>

<div class="flex items-center gap-2 text-sm text-muted-foreground">
	<CheckCircle class="h-4 w-4 text-green-500" />
	{#if children}
		{@render children()}
	{:else}
		<span>You approved this tool execution</span>
	{/if}
</div>

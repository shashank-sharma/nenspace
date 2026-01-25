<script lang="ts">
	import { CheckCircle2, Circle } from "lucide-svelte";
	import { cn } from "$lib/utils";

	type Props = {
		completed?: boolean;
		class?: string;
	};

	let { completed = false, class: className }: Props = $props();
</script>

<div class={cn("flex-shrink-0", className)}>
	{#if completed}
		<CheckCircle2 size={16} class="text-green-500" />
	{:else}
		<Circle size={16} class="text-muted-foreground" />
	{/if}
</div>

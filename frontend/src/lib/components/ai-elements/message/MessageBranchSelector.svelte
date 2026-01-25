<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { ChevronLeft, ChevronRight } from "lucide-svelte";
	import { getMessageBranchState } from "./message-branch-context.svelte.ts";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type Props = {
		totalBranches: number;
		class?: string;
		children?: Snippet;
	};

	let { totalBranches, class: className, children }: Props = $props();

	const branchState = getMessageBranchState();
	const canGoPrev = $derived(branchState.currentBranch > 0);
	const canGoNext = $derived(branchState.currentBranch < totalBranches - 1);

	function handlePrev() {
		if (canGoPrev) {
			branchState.onBranchChange(branchState.currentBranch - 1);
		}
	}

	function handleNext() {
		if (canGoNext) {
			branchState.onBranchChange(branchState.currentBranch + 1);
		}
	}
</script>

{#if totalBranches > 1}
	<div class={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
		{#if children}
			{@render children()}
		{:else}
			<Button
				variant="ghost"
				size="icon"
				class="h-6 w-6"
				onclick={handlePrev}
				disabled={!canGoPrev}
			>
				<ChevronLeft size={16} />
			</Button>
			<span class="text-xs">
				{branchState.currentBranch + 1} / {totalBranches}
			</span>
			<Button
				variant="ghost"
				size="icon"
				class="h-6 w-6"
				onclick={handleNext}
				disabled={!canGoNext}
			>
				<ChevronRight size={16} />
			</Button>
		{/if}
	</div>
{/if}

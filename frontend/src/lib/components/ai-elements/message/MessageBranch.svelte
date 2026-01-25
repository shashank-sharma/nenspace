<script lang="ts">
	import { setMessageBranchState } from "./message-branch-context.svelte.ts";
	import type { Snippet } from "svelte";

	type Props = {
		defaultBranch?: number;
		children?: Snippet;
	};

	let { defaultBranch = 0, children }: Props = $props();

	let currentBranch = $state(defaultBranch);

	function handleBranchChange(index: number) {
		currentBranch = index;
	}

	setMessageBranchState({
		currentBranch,
		totalBranches: 0, // Will be set by content
		onBranchChange: handleBranchChange
	});
</script>

<div class="relative">
	{#if children}
		{@render children()}
	{/if}
</div>

<script lang="ts" generics="T">
	import { getMessageBranchState } from "./message-branch-context.svelte.ts";
	import type { Snippet } from "svelte";

	type Props<T> = {
		content: T[];
		renderItem: Snippet<[T, number]>;
	};

	let { content, renderItem }: Props<T> = $props();

	const branchState = getMessageBranchState();
	const currentItem = $derived(content[branchState.currentBranch] ?? content[0]);
</script>

{#if currentItem}
	{@render renderItem(currentItem, branchState.currentBranch)}
{/if}

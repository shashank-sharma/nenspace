<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Dialog from "$lib/components/ui/dialog";
	import type { Snippet } from "svelte";

	type ModelSelectorProps = {
		open?: boolean;
		children: Snippet;
	};

	let { open = $bindable(false), children }: ModelSelectorProps = $props();
</script>

<Dialog.Root bind:open>
	{@render children()}
</Dialog.Root>

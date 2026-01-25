<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Command from "$lib/components/ui/command";
	import type { Snippet } from "svelte";

	type ModelSelectorContentProps = {
		title?: string;
		description?: string;
		children: Snippet;
		class?: string;
	};

	let {
		title = "Select Model",
		description = "Choose a model to use",
		children,
		class: className,
		...restProps
	}: ModelSelectorContentProps = $props();
</script>

<Dialog.Content class={cn("max-w-2xl", className)} {...restProps}>
	<Dialog.Header>
		<Dialog.Title>{title}</Dialog.Title>
		<Dialog.Description>{description}</Dialog.Description>
	</Dialog.Header>
	<Command.Root class="overflow-hidden rounded-lg border shadow-md">
		{@render children()}
	</Command.Root>
</Dialog.Content>

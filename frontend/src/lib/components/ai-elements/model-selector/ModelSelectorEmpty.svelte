<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Command from "$lib/components/ui/command";

	type ModelSelectorEmptyProps = {
		message?: string;
		class?: string;
	};

	let {
		message = "No models found.",
		class: className,
		...restProps
	}: ModelSelectorEmptyProps = $props();
</script>

<Command.Empty class={className} {...restProps}>{message}</Command.Empty>

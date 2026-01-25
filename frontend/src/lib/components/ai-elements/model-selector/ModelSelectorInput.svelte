<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Command from "$lib/components/ui/command";
	import type { HTMLAttributes } from "svelte/elements";

	type ModelSelectorInputProps = HTMLAttributes<HTMLInputElement> & {
		placeholder?: string;
	};

	let {
		placeholder = "Search models...",
		class: className,
		...restProps
	}: ModelSelectorInputProps = $props();
</script>

<Command.Input {placeholder} class={className} {...restProps} />

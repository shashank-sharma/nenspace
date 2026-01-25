<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Command from "$lib/components/ui/command";

	type ModelSelectorSeparatorProps = {
		class?: string;
	};

	let { class: className, ...restProps }: ModelSelectorSeparatorProps = $props();
</script>

<Command.Separator class={className} {...restProps} />

<script lang="ts">
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { cn } from "$lib/utils";

	type Props = {
		class?: string;
	};

	let { class: className }: Props = $props();
</script>

<DropdownMenu.Separator class={cn("", className)} />

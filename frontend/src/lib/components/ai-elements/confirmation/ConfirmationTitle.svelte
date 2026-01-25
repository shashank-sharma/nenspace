<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Alert from "$lib/components/ui/alert";
	import type { Snippet } from "svelte";

	type ConfirmationTitleProps = {
		class?: string;
		children: Snippet;
	};

	let { class: className, children, ...restProps }: ConfirmationTitleProps = $props();
</script>

<Alert.Title class={className} {...restProps}>
	{@render children()}
</Alert.Title>

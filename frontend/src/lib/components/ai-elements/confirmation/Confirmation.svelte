<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Alert from "$lib/components/ui/alert";
	import type { Snippet } from "svelte";

	type ToolUIPartState =
		| "approval-requested"
		| "approval-responded"
		| "output-denied"
		| "output-available";

	type ToolUIPartApproval = {
		id: string;
		approved?: boolean;
		reason?: string;
	};

	type ConfirmationProps = {
		approval: ToolUIPartApproval;
		state: ToolUIPartState;
		class?: string;
		children: Snippet;
	};

	let {
		approval,
		state,
		class: className,
		children,
		...restProps
	}: ConfirmationProps = $props();

	let alertClasses = $derived(cn("", className));
</script>

<Alert.Root class={alertClasses} {...restProps}>
	{@render children()}
</Alert.Root>

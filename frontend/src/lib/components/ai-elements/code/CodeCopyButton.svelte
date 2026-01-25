<script lang="ts">
	import { Button, type ButtonProps } from "$lib/components/ui/button";
	import { cn } from "$lib/utils";
	import { Check, Copy } from "lucide-svelte";
	import { getContext } from "svelte";

	type CodeCopyButtonProps = ButtonProps & {
		code?: string;
	};

	let {
		code = "",
		variant = "ghost",
		size = "icon",
		class: className,
		...restProps
	}: CodeCopyButtonProps = $props();

	let copied = $state(false);

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(code);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (error) {
			console.error("Failed to copy:", error);
		}
	}

	let buttonClasses = $derived(
		cn(
			"absolute right-2 top-2 h-8 w-8 transition-opacity hover:bg-muted",
			className
		)
	);
</script>

<Button
	type="button"
	{variant}
	{size}
	class={buttonClasses}
	onclick={copyToClipboard}
	{...restProps}
>
	{#if copied}
		<Check class="h-4 w-4" />
	{:else}
		<Copy class="h-4 w-4" />
	{/if}
	<span class="sr-only">{copied ? "Copied" : "Copy code"}</span>
</Button>

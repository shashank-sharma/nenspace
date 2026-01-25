<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { ChevronDown, CheckCircle2, Circle, XCircle, Loader2 } from "lucide-svelte";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	type TaskStatus = "pending" | "in-progress" | "completed" | "error";

	type Props = {
		title: string;
		status?: TaskStatus;
		class?: string;
		children?: Snippet;
	};

	let { title, status = "pending", class: className, children, ...restProps }: Props = $props();

	const statusIcon = $derived(() => {
		switch (status) {
			case "completed":
				return CheckCircle2;
			case "in-progress":
				return Loader2;
			case "error":
				return XCircle;
			default:
				return Circle;
		}
	});

	const statusColor = $derived(() => {
		switch (status) {
			case "completed":
				return "text-green-500";
			case "in-progress":
				return "text-blue-500 animate-spin";
			case "error":
				return "text-red-500";
			default:
				return "text-muted-foreground";
		}
	});
</script>

<Collapsible.Trigger
	class={cn(
		"flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
		className
	)}
	{...restProps}
>
	{#if children}
		{@render children()}
	{:else}
		<div class="flex items-center gap-2">
			<svelte:component this={statusIcon()} size={16} class={statusColor()} />
			<span>{title}</span>
		</div>
		<ChevronDown
			size={16}
			class="transition-transform duration-200 data-[state=open]:rotate-180"
		/>
	{/if}
</Collapsible.Trigger>

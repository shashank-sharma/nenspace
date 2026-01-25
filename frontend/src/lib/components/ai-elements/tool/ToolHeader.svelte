<script lang="ts">
	import { cn } from "$lib/utils";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { Badge } from "$lib/components/ui/badge";
	import { Wrench, Loader2, CheckCircle2, XCircle, ChevronDown } from "lucide-svelte";

	type ToolHeaderProps = {
		type: string;
		state: "input-streaming" | "input-available" | "output-available" | "output-error";
		class?: string;
	};

	let { type, state, class: className, ...restProps }: ToolHeaderProps = $props();

	let statusConfig = $derived.by(() => {
		switch (state) {
			case "input-streaming":
				return {
					label: "Pending",
					variant: "secondary" as const,
					icon: Loader2,
					iconClass: "animate-spin",
				};
			case "input-available":
				return {
					label: "Running",
					variant: "default" as const,
					icon: Loader2,
					iconClass: "animate-spin",
				};
			case "output-available":
				return {
					label: "Completed",
					variant: "default" as const,
					icon: CheckCircle2,
					iconClass: "text-green-500",
				};
			case "output-error":
				return {
					label: "Error",
					variant: "destructive" as const,
					icon: XCircle,
					iconClass: "text-destructive",
				};
		}
	});

	let triggerClasses = $derived(
		cn(
			"flex w-full items-center justify-between p-3 text-sm font-medium transition-all hover:bg-muted/80",
			className
		)
	);
</script>

<Collapsible.Trigger class={triggerClasses} {...restProps}>
	<div class="flex items-center gap-2">
		<Wrench class="h-4 w-4" />
		<span class="font-mono">{type}</span>
		<Badge variant={statusConfig.label}>
			<svelte:component this={statusConfig.icon} class={cn("h-3 w-3 mr-1", statusConfig.iconClass)} />
			{statusConfig.label}
		</Badge>
	</div>
	<ChevronDown class="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
</Collapsible.Trigger>

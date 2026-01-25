<script lang="ts">
	import { cn } from "$lib/utils";
	import { Badge } from "$lib/components/ui/badge";
	import { CheckCircle2, Loader2, Circle } from "lucide-svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";
	import type { Icon } from "lucide-svelte";

	type ChainOfThoughtStepProps = HTMLAttributes<HTMLDivElement> & {
		label: string;
		icon?: typeof Icon;
		description?: string;
		status?: "complete" | "active" | "pending";
		delay?: number;
		children?: Snippet;
	};

	let {
		label,
		icon: IconComponent,
		description,
		status = "complete",
		delay,
		children,
		class: className,
		...restProps
	}: ChainOfThoughtStepProps = $props();

	let statusConfig = $derived.by(() => {
		switch (status) {
			case "complete":
				return {
					icon: CheckCircle2,
					iconClass: "text-green-500",
					lineClass: "bg-green-500",
				};
			case "active":
				return {
					icon: Loader2,
					iconClass: "text-primary animate-spin",
					lineClass: "bg-primary",
				};
			case "pending":
				return {
					icon: Circle,
					iconClass: "text-muted-foreground",
					lineClass: "bg-muted-foreground/30",
				};
		}
	});

	let containerClasses = $derived(
		cn("relative flex gap-3 pb-4 last:pb-0", className)
	);

	let animationStyle = $derived(delay !== undefined ? `animation-delay: ${delay}ms;` : "");
</script>

<div class={containerClasses} style={animationStyle} {...restProps}>
	<div class="relative flex flex-col items-center">
		<div class="flex h-6 w-6 items-center justify-center rounded-full border bg-background">
			<svelte:component
				this={statusConfig.icon}
				class={cn("h-3.5 w-3.5", statusConfig.iconClass)}
			/>
		</div>
		<div class={cn("mt-1 h-full w-px flex-1", statusConfig.lineClass)}></div>
	</div>

	<div class="flex-1 pt-0.5">
		<div class="flex items-center gap-2">
			{#if IconComponent}
				<svelte:component this={IconComponent} class="h-4 w-4 text-muted-foreground" />
			{/if}
			<p class="font-medium text-sm">{label}</p>
		</div>
		{#if description}
			<p class="mt-1 text-sm text-muted-foreground">{description}</p>
		{/if}
		{#if children}
			<div class="mt-2">
				{@render children()}
			</div>
		{/if}
	</div>
</div>

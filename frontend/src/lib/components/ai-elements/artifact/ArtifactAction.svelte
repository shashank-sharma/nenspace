<script lang="ts">
	import { cn } from "$lib/utils";
	import { Button, type ButtonProps } from "$lib/components/ui/button";
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger,
	} from "$lib/components/ui/tooltip";
	import type { Icon } from "lucide-svelte";
	import type { Snippet } from "svelte";

	type ArtifactActionProps = ButtonProps & {
		tooltip?: string;
		label?: string;
		icon?: typeof Icon;
		children?: Snippet;
	};

	let {
		tooltip,
		label,
		icon: IconComponent,
		children,
		variant = "ghost",
		size = "sm",
		class: className,
		...restProps
	}: ArtifactActionProps = $props();

	let buttonClasses = $derived(
		cn("h-8 w-8 p-0", className)
	);
</script>

{#if tooltip}
	<TooltipProvider>
		<Tooltip delayDuration={150}>
			<TooltipTrigger asChild let:builder>
				<Button builders={[builder]} {variant} {size} class={buttonClasses} {...restProps}>
					{#if children}
						{@render children()}
					{:else if IconComponent}
						<svelte:component this={IconComponent} class="h-4 w-4" />
					{/if}
					<span class="sr-only">{label || tooltip}</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent>
				<p>{tooltip}</p>
			</TooltipContent>
		</Tooltip>
	</TooltipProvider>
{:else}
	<Button {variant} {size} class={buttonClasses} {...restProps}>
		{#if children}
			{@render children()}
		{:else if IconComponent}
			<svelte:component this={IconComponent} class="h-4 w-4" />
		{/if}
		<span class="sr-only">{label || tooltip}</span>
	</Button>
{/if}

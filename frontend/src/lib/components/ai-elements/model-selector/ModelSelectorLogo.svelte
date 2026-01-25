<script lang="ts">
	import { cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	type ModelSelectorLogoProps = HTMLAttributes<HTMLImageElement> & {
		provider: string;
	};

	let { provider, class: className, ...restProps }: ModelSelectorLogoProps = $props();

	// models.dev CDN for provider logos
	let logoUrl = $derived(`https://models.dev/logos/${provider.toLowerCase()}.svg`);
</script>

<img
	src={logoUrl}
	alt={`${provider} logo`}
	class={cn("h-5 w-5 rounded-sm object-contain", className)}
	onerror={(e) => {
		// Fallback to a placeholder if logo fails to load
		e.currentTarget.style.display = "none";
	}}
	{...restProps}
/>

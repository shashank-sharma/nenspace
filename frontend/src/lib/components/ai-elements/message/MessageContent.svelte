<script lang="ts">
	import { cn } from "$lib/utils";
	import { tv, type VariantProps } from "tailwind-variants";
	import type { HTMLAttributes } from "svelte/elements";

	const messageContentVariants = tv({
		base: "flex flex-col gap-2 overflow-hidden text-sm leading-relaxed",
		variants: {
			variant: {
				contained: [
					"max-w-[85%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[70%] rounded-lg px-3 py-2.5 sm:px-4 sm:py-3",
					"group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground",
					"group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-foreground",
				],
				flat: [
					"group-[.is-user]:bg-secondary group-[.is-user]:text-foreground group-[.is-user]:max-w-[85%] sm:group-[.is-user]:max-w-[80%] md:group-[.is-user]:max-w-[75%] lg:group-[.is-user]:max-w-[70%] group-[.is-user]:rounded-lg group-[.is-user]:px-3 group-[.is-user]:py-2.5 sm:group-[.is-user]:px-4 sm:group-[.is-user]:py-3",
					"group-[.is-assistant]:text-foreground group-[.is-assistant]:max-w-[85%] sm:group-[.is-assistant]:max-w-[80%] md:group-[.is-assistant]:max-w-[75%] lg:group-[.is-assistant]:max-w-[70%]",
				],
			},
		},
		defaultVariants: {
			variant: "contained",
		},
	});

	type MessageContentProps = HTMLAttributes<HTMLDivElement> &
		VariantProps<typeof messageContentVariants>;

	let { class: className = "", variant, children, ...restProps }: MessageContentProps = $props();

	let id = $props.id();
</script>

<div class={cn(messageContentVariants({ variant }), className)} data-content-id={id} {...restProps}>
	{@render children?.()}
</div>

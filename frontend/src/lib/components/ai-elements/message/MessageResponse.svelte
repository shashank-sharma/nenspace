<script lang="ts">
	import { Response } from "$lib/components/ai-elements/response";
	import { cn } from "$lib/utils";
	import type { StreamdownProps } from "svelte-streamdown";

	type Props = StreamdownProps & {
		content: string;
		class?: string;
	};

	let { content, class: className, ...restProps }: Props = $props();
</script>

<Response {content} class={cn("", className)} {...restProps} />

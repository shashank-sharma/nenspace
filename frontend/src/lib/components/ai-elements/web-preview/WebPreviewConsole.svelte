<script lang="ts">
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	export interface LogEntry {
		timestamp: string;
		message: string;
		type?: "log" | "warn" | "error";
	}

	type Props = {
		logs: LogEntry[];
		class?: string;
		children?: Snippet;
	};

	let { logs, class: className, children }: Props = $props();

	function getLogColor(type?: string) {
		switch (type) {
			case "error":
				return "text-red-500";
			case "warn":
				return "text-yellow-500";
			default:
				return "text-muted-foreground";
		}
	}
</script>

<div class={cn("border-t bg-muted/30", className)}>
	<ScrollArea class="h-[200px]">
		<div class="p-4 space-y-1 font-mono text-xs">
			{#each logs as log}
				<div class="flex gap-2">
					<span class="text-muted-foreground">{log.timestamp}</span>
					<span class={getLogColor(log.type)}>{log.message}</span>
				</div>
			{/each}
			{#if children}
				{@render children()}
			{/if}
		</div>
	</ScrollArea>
</div>

<script lang="ts">
	import { cn } from "$lib/utils";
	import { codeToHtml } from "shiki";
	import { mode } from "mode-watcher";
	import type { BundledLanguage, BundledTheme } from "shiki";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	type CodeProps = HTMLAttributes<HTMLDivElement> & {
		code: string;
		lang?: BundledLanguage;
		variant?: "default" | "ghost";
		hideLines?: boolean;
		highlight?: (number | [number, number])[];
		children?: Snippet;
	};

	let {
		code,
		lang = "typescript",
		variant = "default",
		hideLines = false,
		highlight = [],
		class: className,
		children,
		...restProps
	}: CodeProps = $props();

	let highlightedCode = $state("");
	let isLoading = $state(true);

	// Determine theme based on mode
	let theme = $derived.by(() => {
		return mode.current === "dark" ? "github-dark-default" : "github-light-default";
	});

	// Generate highlighted HTML
	async function generateHighlight() {
		try {
			isLoading = true;
			const html = await codeToHtml(code, {
				lang,
				theme: theme as BundledTheme,
			});
			highlightedCode = html;
		} catch (error) {
			console.error("Failed to highlight code:", error);
			highlightedCode = `<pre><code>${code}</code></pre>`;
		} finally {
			isLoading = false;
		}
	}

	// Re-generate when code, lang, or theme changes
	$effect(() => {
		if (code) {
			generateHighlight();
		}
	});

	let containerClasses = $derived(
		cn(
			"relative overflow-hidden rounded-lg",
			variant === "default" && "border bg-muted/50",
			variant === "ghost" && "bg-transparent",
			className
		)
	);
</script>

<div class={containerClasses} {...restProps}>
	{#if children}
		{@render children()}
	{/if}
	
	{#if isLoading}
		<div class="flex items-center justify-center p-4">
			<div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<div
				class={cn(
					"[&>pre]:m-0 [&>pre]:p-4 [&>pre]:text-sm",
					hideLines && "[&>pre]:pl-4",
					!hideLines && "[&>pre]:pl-12"
				)}
			>
				{@html highlightedCode}
			</div>
		</div>
	{/if}
</div>

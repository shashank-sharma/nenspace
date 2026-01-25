<script lang="ts">
	import { Streamdown, type StreamdownProps } from "svelte-streamdown";
	import Code from "svelte-streamdown/code"; // Shiki syntax highlighting
	import { cn } from "$lib/utils";
	import { mode } from "mode-watcher";

	// Import Shiki themes
	import githubLightDefault from "@shikijs/themes/github-light-default";
	import githubDarkDefault from "@shikijs/themes/github-dark-default";

	type Props = StreamdownProps & {
		class?: string;
	};

	let { class: className, ...restProps }: Props = $props();
	let currentTheme = $derived(
		mode.current === "dark" ? "github-dark-default" : "github-light-default"
	);
</script>

<Streamdown
	class={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:leading-7 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ol]:my-3 [&_pre]:my-4", className)}
	shikiTheme={currentTheme}
	baseTheme="shadcn"
	components={{ code: Code }}
	shikiThemes={{
		"github-light-default": githubLightDefault,
		"github-dark-default": githubDarkDefault,
	}}
	{...restProps}
/>

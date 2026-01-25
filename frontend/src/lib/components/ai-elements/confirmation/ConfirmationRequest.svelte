<script lang="ts">
	import { cn } from "$lib/utils";
	import { getContext } from "svelte";
	import type { Snippet } from "svelte";

	type ConfirmationRequestProps = {
		children: Snippet;
	};

	let { children }: ConfirmationRequestProps = $props();
</script>

{@render children()}

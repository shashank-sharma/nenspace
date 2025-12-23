<script lang="ts">
	import { browser } from "$app/environment";
	import type {
		ExcalidrawImperativeAPI,
		ExcalidrawInitialDataState,
	} from "@excalidraw/excalidraw/types/types.js";
	import type { AppState, ExcalidrawElement } from "@excalidraw/excalidraw/types/types.js";

	if (browser) {
		window.process = { env: { IS_PREACT: false } } as any;
	}

	let {
		initialData = {},
		excalidrawAPI = $bindable(undefined),
		theme = "light",
		onChangeHandler = undefined,
		onReadyHandler = undefined,
	} = $props<{
		initialData?: ExcalidrawInitialDataState;
		excalidrawAPI?: ExcalidrawImperativeAPI | undefined;
		theme?: "light" | "dark";
		onChangeHandler?: ((elements: ExcalidrawElement[], state: AppState) => void) | undefined;
		onReadyHandler?: ((api: ExcalidrawImperativeAPI) => void) | undefined;
	}>();
</script>

<div class="excalidraw-wrapper">
	{#if browser}
		{#await import("./Excalidraw.svelte")}
			<div class="flex items-center justify-center h-full">
				<div class="text-muted-foreground">Loading Excalidraw...</div>
			</div>
			{:then { default: Excalidraw }}
				<Excalidraw
					{initialData}
					bind:excalidrawAPI
					{theme}
					{onChangeHandler}
					{onReadyHandler}
				/>
			{:catch error}
				<div class="flex items-center justify-center h-full">
					<div class="text-destructive">Failed to load Excalidraw: {error.message}</div>
				</div>
		{/await}
	{:else}
		<div class="flex items-center justify-center h-full">
			<div class="text-muted-foreground">Not available in SSR</div>
		</div>
	{/if}
</div>

<style>
	.excalidraw-wrapper {
		width: 100% !important;
		height: 100% !important;
		min-height: 100% !important;
		max-height: 100% !important;
		min-width: 100% !important;
		max-width: 100% !important;
		position: relative;
		overflow: hidden;
		display: flex !important;
		flex-direction: column;
		box-sizing: border-box;
		flex: 1 1 auto;
	}
	
	.excalidraw-wrapper > * {
		width: 100% !important;
		height: 100% !important;
		flex: 1 1 auto;
		min-height: 100% !important;
		max-height: 100% !important;
	}
</style>

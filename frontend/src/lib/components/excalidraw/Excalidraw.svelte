<script lang="ts">
	import ReactComponent from "./ReactComponent.svelte";
	import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
	import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types.js";
	import type {
		AppState,
		ExcalidrawImperativeAPI,
		ExcalidrawInitialDataState,
	} from "@excalidraw/excalidraw/types/types.js";
	import React from "react";
	import { createEventDispatcher } from "svelte";
	
	// Import Excalidraw CSS styles - critical for proper rendering
	import "@excalidraw/excalidraw/index.css";

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

	const dispatcher = createEventDispatcher<{
		init: void;
		change: { elements: ExcalidrawElement[]; state: AppState };
		ready: ExcalidrawImperativeAPI;
	}>();

	function setAPI(api: ExcalidrawImperativeAPI | null) {
		console.log("[Excalidraw] setAPI called with:", !!api, api);
		
		if (!api) {
			console.warn("[Excalidraw] setAPI called with null/undefined API");
			return;
		}
		
		// Update the bindable prop - this will propagate up to parent
		excalidrawAPI = api;
		dispatcher("ready", api);
		dispatcher("init");
		
		console.log("[Excalidraw] Calling onReadyHandler:", !!onReadyHandler);
		if (onReadyHandler) {
			try {
				onReadyHandler(api);
				console.log("[Excalidraw] onReadyHandler called successfully");
			} catch (e) {
				console.error("[Excalidraw] Error in onReadyHandler:", e);
			}
		} else {
			console.warn("[Excalidraw] No onReadyHandler provided");
		}
		
		console.log("[Excalidraw] API set via ref callback:", !!api);
	}

	function onChange(elements: ExcalidrawElement[], state: AppState) {
		dispatcher("change", { elements, state });
		if (onChangeHandler) {
			onChangeHandler(elements, state);
		}
	}

	const reactMainMenu = React.createElement(MainMenu, null, [
		React.createElement(MainMenu.DefaultItems.SaveAsImage, { key: "SaveAsImage" }),
		React.createElement(MainMenu.DefaultItems.Export, { key: "Export" }),
	]);
</script>

<ReactComponent
	{onChange}
	excalidrawAPI={setAPI}
	this={Excalidraw}
	initialData={initialData || undefined}
	{theme}
	langCode="en-US"
	children={reactMainMenu}
/>

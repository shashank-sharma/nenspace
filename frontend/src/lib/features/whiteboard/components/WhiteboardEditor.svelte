<script lang="ts">
	import AsyncExcalidraw from "$lib/components/excalidraw/AsyncExcalidraw.svelte";
	import type {
		ExcalidrawImperativeAPI,
		ExcalidrawInitialDataState,
	} from "@excalidraw/excalidraw/types/types.js";
	import type { ExcalidrawElement, AppState } from "@excalidraw/excalidraw/types/types.js";
	import type { WhiteboardEntry, ExcalidrawContent } from "../types";
	import { ThemeService } from "$lib/services/theme.service.svelte";
	import { createEventDispatcher, onMount } from "svelte";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Textarea } from "$lib/components/ui/textarea";
	import { Save, X } from "lucide-svelte";

	let {
		entry = null,
		mode = "create",
		onClose,
	} = $props<{
		entry?: WhiteboardEntry | null;
		mode?: "create" | "edit";
		onClose: () => void;
	}>();

	const dispatch = createEventDispatcher<{
		save: { title: string; description: string; content: ExcalidrawContent | null };
	}>();

	let excalidrawAPI: ExcalidrawImperativeAPI | undefined = $state(undefined);
	let title = $state("");
	let description = $state("");
	let initialData = $state<ExcalidrawInitialDataState | null>(null);
	let isSaving = $state(false);

	const theme = $derived(
		ThemeService.theme === "dark" || ThemeService.theme === "system"
			? (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light")
			: "light",
	);

	onMount(() => {
		if (mode === "edit" && entry) {
			title = entry.title;
			description = entry.description;
			if (entry.content) {
				initialData = {
					elements: entry.content.elements,
					appState: entry.content.appState,
				};
			}
		}
	});

	function handleSave() {
		if (!title.trim()) {
			return;
		}

		let content: ExcalidrawContent | null = null;
		if (excalidrawAPI) {
			const elements = excalidrawAPI.getSceneElements();
			const appState = excalidrawAPI.getAppState();
			content = {
				elements,
				appState,
			};
		}

		dispatch("save", {
			title: title.trim(),
			description: description.trim(),
			content,
		});
	}

	function handleChange(elements: ExcalidrawElement[], state: AppState) {
		// Content is automatically captured on save
	}
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="flex items-center justify-between p-4 border-b">
		<h2 class="text-lg font-semibold">{mode === "create" ? "New Whiteboard" : "Edit Whiteboard"}</h2>
		<Button variant="ghost" size="icon" onclick={onClose}>
			<X class="h-4 w-4" />
		</Button>
	</div>

	<!-- Form Fields -->
	<div class="p-4 border-b space-y-4">
		<div class="space-y-2">
			<Label for="title">Title</Label>
			<Input
				id="title"
				bind:value={title}
				placeholder="Enter whiteboard title..."
				disabled={isSaving}
			/>
		</div>
		<div class="space-y-2">
			<Label for="description">Description</Label>
			<Textarea
				id="description"
				bind:value={description}
				placeholder="Enter description (optional)..."
				rows={2}
				disabled={isSaving}
			/>
		</div>
	</div>

	<!-- Excalidraw Editor -->
	<div 
		class="excalidraw-container" 
		style="height: 500px; width: 600px; max-width: 600px; min-height: 400px; max-height: 600px; position: relative; overflow: visible; box-sizing: border-box;"
		id="excalidraw-container"
	>
		<AsyncExcalidraw
			{initialData}
			bind:excalidrawAPI
			{theme}
			onChangeHandler={handleChange}
		/>
	</div>

	<!-- Footer Actions -->
	<div class="flex items-center justify-end gap-2 p-4 border-t">
		<Button variant="outline" onclick={onClose} disabled={isSaving}>
			Cancel
		</Button>
		<Button onclick={handleSave} disabled={isSaving || !title.trim()}>
			<Save class="h-4 w-4 mr-2" />
			{isSaving ? "Saving..." : "Save"}
		</Button>
	</div>
</div>

<style>
	.excalidraw-container {
		flex: 1 1 auto;
		min-height: 400px;
		max-height: 600px;
		height: 500px;
		width: 600px;
		max-width: 600px;
		position: relative;
		overflow: visible; /* Changed to visible for proper canvas rendering */
		box-sizing: border-box;
	}
</style>

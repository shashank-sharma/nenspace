<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Textarea } from "$lib/components/ui/textarea";
	import { Badge } from "$lib/components/ui/badge";
	import { Plus } from "lucide-svelte";
	import type { WhiteboardEntry, WhiteboardFormData } from "../types";
	import { createEventDispatcher } from "svelte";

	let {
		open = false,
		entry = null,
		mode = "create",
		onClose,
	} = $props<{
		open?: boolean;
		entry?: WhiteboardEntry | null;
		mode?: "create" | "edit";
		onClose?: () => void;
	}>();

	const dispatch = createEventDispatcher<{
		save: WhiteboardFormData;
	}>();

	let title = $state("");
	let description = $state("");
	let tags = $state<string[]>([]);
	let newTag = $state("");
	let isSubmitting = $state(false);

	$effect(() => {
		if (open && entry) {
			title = entry.title || "";
			description = entry.description || "";
			tags = [...(entry.tags || [])];
		} else if (open && !entry) {
			title = "";
			description = "";
			tags = [];
		}
	});

	function addTag() {
		const trimmed = newTag.trim();
		if (trimmed && !tags.includes(trimmed)) {
			tags = [...tags, trimmed];
			newTag = "";
		}
	}

	function removeTag(tag: string) {
		tags = tags.filter((t) => t !== tag);
	}

	function handleTagKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			addTag();
		}
	}

	function handleSave() {
		if (!title.trim()) {
			return;
		}

		dispatch("save", {
			title: title.trim(),
			description: description.trim(),
			tags,
			content: null, // Content will be set by parent from canvas
		});
	}

	function handleClose() {
		if (!isSubmitting) {
			title = "";
			description = "";
			tags = [];
			newTag = "";
			onClose?.();
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={(value) => !value && handleClose()}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>{mode === "edit" ? "Save Whiteboard" : "Save New Whiteboard"}</Dialog.Title>
			<Dialog.Description>
				Enter details to save your whiteboard. Title is required.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label for="title">
					Title <span class="text-destructive">*</span>
				</Label>
				<Input
					id="title"
					bind:value={title}
					placeholder="Enter whiteboard title..."
					disabled={isSubmitting}
					required
					onkeydown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							if (title.trim()) {
								handleSave();
							}
						}
					}}
				/>
			</div>

			<div class="space-y-2">
				<Label for="description">Description (optional)</Label>
				<Textarea
					id="description"
					bind:value={description}
					placeholder="Enter description..."
					rows={3}
					disabled={isSubmitting}
				/>
			</div>

			<div class="space-y-2">
				<Label for="tags">Tags (optional)</Label>
				<div class="space-y-2">
					{#if tags.length > 0}
						<div class="flex flex-wrap gap-1.5">
							{#each tags as tag}
								<Badge variant="secondary" class="text-xs py-1 px-2 gap-1">
									{tag}
									<button
										type="button"
										onclick={() => removeTag(tag)}
										class="ml-0.5 hover:text-destructive"
										disabled={isSubmitting}
										aria-label="Remove tag"
									>
										×
									</button>
								</Badge>
							{/each}
						</div>
					{/if}
					<div class="flex gap-2">
						<Input
							id="tags"
							placeholder="Add tag..."
							bind:value={newTag}
							onkeydown={handleTagKeydown}
							disabled={isSubmitting}
							class="flex-1"
						/>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							onclick={addTag}
							disabled={!newTag.trim() || isSubmitting}
							class="h-9 w-9 p-0"
						>
							<Plus class="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={handleClose} disabled={isSubmitting}>
				Cancel
			</Button>
			<Button onclick={handleSave} disabled={isSubmitting || !title.trim()}>
				Save
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

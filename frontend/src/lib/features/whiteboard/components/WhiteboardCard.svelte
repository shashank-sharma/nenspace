<script lang="ts">
	import type { WhiteboardEntry } from "../types";
	import { formatDateGroup, formatTime } from "../types";
	import { Button } from "$lib/components/ui/button";
	import * as Card from "$lib/components/ui/card";
	import { Edit, Trash2, Calendar, Clock } from "lucide-svelte";
	import { createEventDispatcher } from "svelte";

	let { entry } = $props<{ entry: WhiteboardEntry }>();

	const dispatch = createEventDispatcher<{
		edit: WhiteboardEntry;
		delete: WhiteboardEntry;
		open: WhiteboardEntry;
	}>();

	function handleEdit(e: MouseEvent) {
		e.stopPropagation();
		dispatch("edit", entry);
	}

	function handleDelete(e: MouseEvent) {
		e.stopPropagation();
		dispatch("delete", entry);
	}

	function handleClick() {
		dispatch("open", entry);
	}
</script>

<Card.Root
	class="cursor-pointer hover:shadow-md transition-shadow"
	onclick={handleClick}
>
	<Card.Header>
		<div class="flex items-start justify-between gap-2">
			<div class="flex-1 min-w-0">
				<Card.Title class="text-lg font-semibold truncate">{entry.title || "Untitled"}</Card.Title>
				{#if entry.description}
					<Card.Description class="mt-1 line-clamp-2">{entry.description}</Card.Description>
				{/if}
			</div>
			<div class="flex gap-1 flex-shrink-0">
				<Button variant="ghost" size="icon" class="h-8 w-8" onclick={handleEdit}>
					<Edit class="h-4 w-4" />
				</Button>
				<Button variant="ghost" size="icon" class="h-8 w-8" onclick={handleDelete}>
					<Trash2 class="h-4 w-4" />
				</Button>
			</div>
		</div>
	</Card.Header>
	<Card.Content>
		{#if entry.content?.elements && entry.content.elements.length > 0}
			<div class="aspect-video bg-muted rounded-md flex items-center justify-center mb-3">
				<div class="text-sm text-muted-foreground">
					{entry.content.elements.length} element{entry.content.elements.length !== 1 ? "s" : ""}
				</div>
			</div>
		{:else}
			<div class="aspect-video bg-muted rounded-md flex items-center justify-center mb-3">
				<div class="text-sm text-muted-foreground">Empty whiteboard</div>
			</div>
		{/if}
		{#if entry.tags && entry.tags.length > 0}
			<div class="flex flex-wrap gap-1 mb-2">
				{#each entry.tags as tag}
					<span class="text-xs px-2 py-1 bg-secondary rounded-md text-secondary-foreground">
						{tag}
					</span>
				{/each}
			</div>
		{/if}
	</Card.Content>
	<Card.Footer class="flex items-center gap-4 text-sm text-muted-foreground">
		<div class="flex items-center gap-1">
			<Calendar class="h-4 w-4" />
			<span>{formatDateGroup(entry.updated)}</span>
		</div>
		<div class="flex items-center gap-1">
			<Clock class="h-4 w-4" />
			<span>{formatTime(entry.updated)}</span>
		</div>
	</Card.Footer>
</Card.Root>




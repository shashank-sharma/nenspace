<script lang="ts">
	import type { WhiteboardEntry } from "../types";
	import { Button } from "$lib/components/ui/button";
	import * as Card from "$lib/components/ui/card";
	import { Plus, X, Calendar, Clock } from "lucide-svelte";
	import { formatDateGroup, formatTime } from "../types";
	import { createEventDispatcher } from "svelte";

	let {
		entries = [],
		activeId = null,
		onSelect,
		onNew,
		onDelete,
	} = $props<{
		entries?: WhiteboardEntry[];
		activeId?: string | null;
		onSelect?: (entry: WhiteboardEntry) => void;
		onNew?: () => void;
		onDelete?: (entry: WhiteboardEntry) => void;
	}>();

	const dispatch = createEventDispatcher<{
		select: WhiteboardEntry;
		new: void;
		delete: WhiteboardEntry;
	}>();

	function handleSelect(entry: WhiteboardEntry) {
		dispatch("select", entry);
		onSelect?.(entry);
	}

	function handleNew() {
		dispatch("new");
		onNew?.();
	}

	function handleDelete(entry: WhiteboardEntry, e: MouseEvent) {
		e.stopPropagation();
		dispatch("delete", entry);
		onDelete?.(entry);
	}
</script>

<div class="floating-cards-container">
	<div class="floating-cards-scroll">
		<!-- New Whiteboard Card -->
		<Card.Root
			class="new-whiteboard-card"
			onclick={handleNew}
			role="button"
			tabindex="0"
			onkeydown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					handleNew();
				}
			}}
		>
			<Card.Header class="p-4">
				<div class="flex flex-col items-center justify-center h-full gap-2">
					<Plus class="h-6 w-6 text-muted-foreground" />
					<Card.Title class="text-sm font-medium text-center">New Whiteboard</Card.Title>
				</div>
			</Card.Header>
		</Card.Root>

		<!-- Existing Whiteboard Cards -->
		{#each entries as entry (entry.id)}
			<Card.Root
				class="whiteboard-card group {activeId === entry.id ? 'active' : ''}"
				onclick={() => handleSelect(entry)}
				role="button"
				tabindex="0"
				onkeydown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleSelect(entry);
					}
				}}
			>
				<Card.Header class="p-3">
					<div class="flex items-start justify-between gap-2">
						<div class="flex-1 min-w-0">
							<Card.Title class="text-sm font-semibold truncate">{entry.title || "Untitled"}</Card.Title>
							{#if entry.description}
								<Card.Description class="text-xs mt-1 line-clamp-2 text-muted-foreground">
									{entry.description}
								</Card.Description>
							{/if}
						</div>
						<Button
							variant="ghost"
							size="icon"
							class="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
							onclick={(e) => handleDelete(entry, e)}
							aria-label="Delete whiteboard"
						>
							<X class="h-3 w-3" />
						</Button>
					</div>
				</Card.Header>
				<Card.Content class="p-3 pt-0">
					{#if entry.content?.elements && entry.content.elements.length > 0}
						<div class="aspect-video bg-muted rounded-md flex items-center justify-center mb-2">
							<div class="text-xs text-muted-foreground">
								{entry.content.elements.length} element{entry.content.elements.length !== 1 ? "s" : ""}
							</div>
						</div>
					{:else}
						<div class="aspect-video bg-muted rounded-md flex items-center justify-center mb-2">
							<div class="text-xs text-muted-foreground">Empty</div>
						</div>
					{/if}
					{#if entry.tags && entry.tags.length > 0}
						<div class="flex flex-wrap gap-1 mb-2">
							{#each entry.tags.slice(0, 3) as tag}
								<span class="text-xs px-1.5 py-0.5 bg-secondary rounded text-secondary-foreground">
									{tag}
								</span>
							{/each}
							{#if entry.tags.length > 3}
								<span class="text-xs px-1.5 py-0.5 text-muted-foreground">
									+{entry.tags.length - 3}
								</span>
							{/if}
						</div>
					{/if}
				</Card.Content>
				<Card.Footer class="p-3 pt-0 flex items-center gap-2 text-xs text-muted-foreground">
					<div class="flex items-center gap-1">
						<Calendar class="h-3 w-3" />
						<span>{formatDateGroup(entry.updated)}</span>
					</div>
				</Card.Footer>
			</Card.Root>
		{/each}
	</div>
</div>

<style>
	.floating-cards-container {
		position: sticky;
		top: 0;
		z-index: 10;
		background: hsl(var(--background));
		border-bottom: 1px solid hsl(var(--border));
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.floating-cards-scroll {
		display: flex;
		gap: 0.75rem;
		overflow-x: auto;
		overflow-y: hidden;
		padding-bottom: 0.5rem;
		scrollbar-width: thin;
		scrollbar-color: hsl(var(--border)) transparent;
	}

	.floating-cards-scroll::-webkit-scrollbar {
		height: 6px;
	}

	.floating-cards-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.floating-cards-scroll::-webkit-scrollbar-thumb {
		background: hsl(var(--border));
		border-radius: 3px;
	}

	.new-whiteboard-card {
		min-width: 160px;
		width: 160px;
		cursor: pointer;
		transition: all 0.2s;
		border: 2px dashed hsl(var(--border));
	}

	.new-whiteboard-card:hover {
		border-color: hsl(var(--primary));
		background: hsl(var(--accent));
	}

	.whiteboard-card {
		min-width: 200px;
		width: 200px;
		cursor: pointer;
		transition: all 0.2s;
		position: relative;
	}

	.whiteboard-card:hover {
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
	}

	.whiteboard-card.active {
		border: 2px solid hsl(var(--primary));
		box-shadow: 0 0 0 1px hsl(var(--primary));
	}

	.whiteboard-card.group {
		position: relative;
	}

	.whiteboard-card :global(.group-hover\:opacity-100) {
		opacity: 0;
	}

	.whiteboard-card:hover :global(.group-hover\:opacity-100) {
		opacity: 1;
	}
</style>

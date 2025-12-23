<script lang="ts">
	import type { WhiteboardEntry } from "../types";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Card from "$lib/components/ui/card";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Plus, X, Search, Calendar } from "lucide-svelte";
	import { formatDateGroup, formatTime } from "../types";
	import { WhiteboardService } from "../services";
	import { FileService } from "$lib/services/file-token";
	import { createEventDispatcher } from "svelte";

	let {
		open = $bindable(false),
		entries = [],
		activeId = null,
		onSelect,
		onNew,
		onDelete,
	} = $props<{
		open?: boolean;
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
		close: void;
	}>();

	let searchTerm = $state("");
	let thumbnailUrls = $state<Record<string, string>>({});

	const filteredEntries = $derived.by(() => {
		if (!searchTerm.trim()) return entries;
		
		const term = searchTerm.toLowerCase();
		return entries.filter((entry) => {
			return (
				entry.title.toLowerCase().includes(term) ||
				entry.description.toLowerCase().includes(term) ||
				entry.tags.some((tag) => tag.toLowerCase().includes(term))
			);
		});
	});

	// Load thumbnail URLs when entries change (with authentication)
	$effect(() => {
		async function loadThumbnails() {
			if (entries.length === 0) return;
			
			const newUrls: Record<string, string> = {};
			
			// Debug: log entries with thumbnails
			const entriesWithThumbnails = entries.filter((entry) => entry.thumbnail);
			console.log("[WhiteboardListModal] Entries with thumbnails:", entriesWithThumbnails.length, entriesWithThumbnails.map(e => ({ id: e.id, thumbnail: e.thumbnail })));
			
			const thumbnailPromises = entriesWithThumbnails
				.map(async (entry) => {
					try {
						console.log("[WhiteboardListModal] Loading thumbnail for entry:", entry.id, "thumbnail:", entry.thumbnail);
						const baseUrl = WhiteboardService.getThumbnailUrl(entry);
						console.log("[WhiteboardListModal] Base URL:", baseUrl);
						
						if (!baseUrl) {
							console.warn("[WhiteboardListModal] No base URL for entry:", entry.id);
							return null;
						}
						
						// Get authenticated URL for PocketBase files
						const authenticatedUrl = await FileService.getAuthenticatedFileUrl(baseUrl);
						console.log("[WhiteboardListModal] Authenticated URL for entry:", entry.id, authenticatedUrl);
						return { id: entry.id, url: authenticatedUrl };
					} catch (error) {
						console.error(`[WhiteboardListModal] Failed to load thumbnail for entry ${entry.id}:`, error);
						return null;
					}
				});

			const results = await Promise.allSettled(thumbnailPromises);
			
			results.forEach((result) => {
				if (result.status === "fulfilled" && result.value) {
					newUrls[result.value.id] = result.value.url;
				} else if (result.status === "rejected") {
					console.error("[WhiteboardListModal] Thumbnail promise rejected:", result.reason);
				}
			});
			
			console.log("[WhiteboardListModal] Final thumbnail URLs:", newUrls);
			thumbnailUrls = newUrls;
		}
		
		loadThumbnails();
	});

	function handleSelect(entry: WhiteboardEntry) {
		dispatch("select", entry);
		onSelect?.(entry);
		open = false;
		dispatch("close");
	}

	function handleNew() {
		dispatch("new");
		onNew?.();
		open = false;
		dispatch("close");
	}

	function handleDelete(entry: WhiteboardEntry, e: MouseEvent) {
		e.stopPropagation();
		dispatch("delete", entry);
		onDelete?.(entry);
	}

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;
		if (!newOpen) {
			dispatch("close");
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="sm:max-w-4xl max-h-[80vh]">
		<Dialog.Header>
			<Dialog.Title>Whiteboards</Dialog.Title>
			<Dialog.Description>Browse and manage your whiteboards</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-4">
			<!-- Search and New Button -->
			<div class="flex gap-2">
				<div class="relative flex-1">
					<Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search whiteboards..."
						class="pl-9"
						bind:value={searchTerm}
					/>
				</div>
				<Button onclick={handleNew}>
					<Plus class="h-4 w-4 mr-2" />
					New Whiteboard
				</Button>
			</div>

			<!-- Grid of Whiteboards -->
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[50vh] pr-2">
				{#if filteredEntries.length === 0}
					<div class="col-span-full flex flex-col items-center justify-center py-12 text-center">
						<p class="text-muted-foreground mb-4">
							{searchTerm ? "No whiteboards found matching your search" : "No whiteboards yet"}
						</p>
						<Button onclick={handleNew} variant="outline">
							<Plus class="h-4 w-4 mr-2" />
							Create your first whiteboard
						</Button>
					</div>
				{:else}
					{#each filteredEntries as entry (entry.id)}
						<Card.Root
							class="whiteboard-grid-card cursor-pointer hover:shadow-md transition-shadow {activeId === entry.id ? 'ring-2 ring-primary' : ''}"
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
							<Card.Header class="p-4">
								<div class="flex items-start justify-between gap-2 group">
									<div class="flex-1 min-w-0">
										<Card.Title class="text-base font-semibold truncate">
											{entry.title || "Untitled"}
										</Card.Title>
										{#if entry.description}
											<Card.Description class="text-sm mt-1 line-clamp-2 text-muted-foreground">
												{entry.description}
											</Card.Description>
										{/if}
									</div>
									<Button
										variant="ghost"
										size="icon"
										class="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
										onclick={(e) => handleDelete(entry, e)}
										aria-label="Delete whiteboard"
									>
										<X class="h-4 w-4" />
									</Button>
								</div>
							</Card.Header>
							<Card.Content class="p-4 pt-0">
								{#if thumbnailUrls[entry.id]}
									<div class="aspect-video bg-muted rounded-md overflow-hidden mb-3 relative">
										<img
											src={thumbnailUrls[entry.id]}
											alt={entry.title || "Whiteboard thumbnail"}
											class="w-full h-full object-contain"
											loading="lazy"
											onerror={(e) => {
												// Fallback to elements display if image fails to load
												delete thumbnailUrls[entry.id];
												thumbnailUrls = { ...thumbnailUrls };
											}}
										/>
									</div>
								{:else if entry.content?.elements && entry.content.elements.length > 0}
									<div class="aspect-video bg-muted rounded-md flex items-center justify-center mb-3">
										<div class="text-sm text-muted-foreground">
											{entry.content.elements.length} element{entry.content.elements.length !== 1 ? "s" : ""}
										</div>
									</div>
								{:else}
									<div class="aspect-video bg-muted rounded-md flex items-center justify-center mb-3">
										<div class="text-sm text-muted-foreground">Empty</div>
									</div>
								{/if}
								{#if entry.tags && entry.tags.length > 0}
									<div class="flex flex-wrap gap-1 mb-3">
										{#each entry.tags.slice(0, 4) as tag}
											<span class="text-xs px-2 py-1 bg-secondary rounded text-secondary-foreground">
												{tag}
											</span>
										{/each}
										{#if entry.tags.length > 4}
											<span class="text-xs px-2 py-1 text-muted-foreground">
												+{entry.tags.length - 4}
											</span>
										{/if}
									</div>
								{/if}
							</Card.Content>
							<Card.Footer class="p-4 pt-0 flex items-center gap-2 text-xs text-muted-foreground">
								<div class="flex items-center gap-1">
									<Calendar class="h-3 w-3" />
									<span>{formatDateGroup(entry.updated)}</span>
									<span>•</span>
									<span>{formatTime(entry.updated)}</span>
								</div>
							</Card.Footer>
						</Card.Root>
					{/each}
				{/if}
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<style>
	.whiteboard-grid-card {
		transition: all 0.2s;
	}

	.whiteboard-grid-card:hover {
		transform: translateY(-2px);
	}
</style>


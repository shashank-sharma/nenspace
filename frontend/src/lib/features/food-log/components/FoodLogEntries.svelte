<script lang="ts">
    import { Calendar, Clock, Tag, Image } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import type { FoodLogEntry } from "../types";
    import {
        groupEntriesByDate,
        formatDateGroup,
        formatTag,
        formatTime,
    } from "../types";
    import {
        IMAGE_RETRY_ATTEMPTS,
        IMAGE_RETRY_BASE_DELAY_MS,
    } from "../constants";
    import * as Dialog from "$lib/components/ui/dialog";
    import { createEventDispatcher, onDestroy } from "svelte";

    let {
        entries = [],
        mealImages = {},
        showImages = true,
        showMetadata = false,
    } = $props<{
        entries: FoodLogEntry[];
        mealImages: Record<string, string>;
        showImages?: boolean;
        showMetadata?: boolean;
    }>();

    const dispatch = createEventDispatcher<{
        delete: string;
        edit: FoodLogEntry;
        refreshImage: string;
    }>();

    let selectedEntry = $state<FoodLogEntry | null>(null);
    let detailsOpen = $state(false);
    let entryToDelete = $state<FoodLogEntry | null>(null);
    let confirmDeleteOpen = $state(false);
    let failedImages = $state<Record<string, number>>({});
    let retryTimeouts = $state<Record<string, number>>({});

    // ✅ FIXED: Cleanup timeouts on destroy to prevent memory leaks
    onDestroy(() => {
        Object.values(retryTimeouts).forEach((timeout) => {
            window.clearTimeout(timeout);
        });
    });

    function confirmDelete(entry: FoodLogEntry) {
        entryToDelete = entry;
        confirmDeleteOpen = true;
    }

    function handleDelete() {
        if (entryToDelete) {
            dispatch("delete", entryToDelete.id);
            confirmDeleteOpen = false;
            detailsOpen = false;
            entryToDelete = null;
        }
    }

    // Handle image load failure with retry mechanism
    function handleImageError(event: Event, entryId: string) {
        const img = event.target as HTMLImageElement;

        if (!failedImages[entryId]) {
            failedImages[entryId] = 0;
        }

        // Limit retries to configured attempts
        if (failedImages[entryId] < IMAGE_RETRY_ATTEMPTS) {
            failedImages[entryId]++;
            console.log(
                `Retrying image load for entry ${entryId}, attempt ${failedImages[entryId]} (will refresh token)`,
            );

            // Clear previous timeout if exists
            if (retryTimeouts[entryId]) {
                window.clearTimeout(retryTimeouts[entryId]);
            }

            // Exponential backoff
            const delay =
                Math.pow(2, failedImages[entryId] - 1) *
                IMAGE_RETRY_BASE_DELAY_MS;
            retryTimeouts[entryId] = window.setTimeout(() => {
                // Dispatch event to parent to refresh the image URL with a new token
                dispatch("refreshImage", entryId);

                // Clean up after retry
                delete retryTimeouts[entryId];
            }, delay);
        } else {
            console.error(
                `Failed to load image for entry ${entryId} after ${IMAGE_RETRY_ATTEMPTS} attempts`,
            );
        }
    }

    function openDetails(entry: FoodLogEntry) {
        selectedEntry = entry;
        detailsOpen = true;
    }

    function handleEdit(entry: FoodLogEntry) {
        dispatch("edit", entry);
        detailsOpen = false;
    }

    function formatDateTime(dateString: string): string {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return "Invalid Date/Time";
            }
            return date.toLocaleString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            });
        } catch (error) {
            console.error(`Error formatting date/time: ${dateString}`, error);
            return "Invalid Date/Time";
        }
    }
</script>

<div class="space-y-4">
    {#if entries.length === 0}
        <div class="text-center py-12 text-muted-foreground">
            <p class="text-lg">No food entries yet</p>
            <p class="text-sm mt-2">Start by adding your first meal!</p>
        </div>
    {:else}
        {#each Object.entries(groupEntriesByDate(entries)) as [date, dayEntries]}
            <div class="date-group">
                <h2
                    class="text-lg font-semibold my-2 sticky top-0 bg-background z-10 py-2"
                >
                    {formatDateGroup(date)}
                </h2>
                <div
                    class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                >
                    {#each dayEntries as entry (entry.id)}
                        <button
                            class="photo-item-container text-left focus:outline-none focus:ring-2 focus:ring-primary rounded-lg active:scale-95 transition-transform duration-150"
                            onclick={() => openDetails(entry)}
                            aria-label={`View details for ${entry.name}`}
                        >
                            {#if showImages && mealImages[entry.id]}
                                <div class="photo-item">
                                    <img
                                        src={mealImages[entry.id]}
                                        alt={entry.name}
                                        loading="lazy"
                                        decoding="async"
                                        class="photo-image"
                                        onerror={(e) =>
                                            handleImageError(e, entry.id)}
                                    />
                                    <div class="photo-overlay">
                                        <div class="photo-info">
                                            <p class="photo-title">
                                                {entry.name}
                                            </p>
                                            <div class="photo-meta">
                                                <Badge class="photo-tag">
                                                    {formatTag(entry.tag)}
                                                </Badge>
                                                <p class="photo-time">
                                                    {formatTime(entry.date)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            {:else if showImages}
                                <div class="image-loading-placeholder">
                                    <div class="loader"></div>
                                </div>
                            {:else}
                                <!-- Text-only view when images are disabled -->
                                <div
                                    class="p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                                >
                                    <p class="font-medium text-sm mb-2">
                                        {entry.name}
                                    </p>
                                    <div
                                        class="flex flex-wrap gap-2 items-center text-xs"
                                    >
                                        <Badge variant="secondary">
                                            {formatTag(entry.tag)}
                                        </Badge>
                                        <span class="text-muted-foreground">
                                            {formatTime(entry.date)}
                                        </span>
                                    </div>
                                </div>
                            {/if}
                        </button>
                    {/each}
                </div>
            </div>
        {/each}
    {/if}
</div>

<!-- Details Dialog -->
<Dialog.Root bind:open={detailsOpen}>
    <Dialog.Content class="sm:max-w-[600px]">
        <Dialog.Header>
            <Dialog.Title>
                {selectedEntry?.name || "Food Details"}
            </Dialog.Title>
            <Dialog.Description>
                Detailed view of your food log entry
            </Dialog.Description>
        </Dialog.Header>

        {#if selectedEntry}
            <div class="food-details space-y-4 my-4">
                {#if selectedEntry.image && mealImages[selectedEntry.id]}
                    <div
                        class="image-container max-h-[400px] overflow-hidden rounded-md"
                    >
                        <img
                            src={mealImages[selectedEntry.id]}
                            alt={selectedEntry.name}
                            loading="lazy"
                            decoding="async"
                            class="w-full object-contain max-h-[400px]"
                            onerror={(e) =>
                                handleImageError(e, selectedEntry?.id || "")}
                        />
                    </div>
                {:else if selectedEntry.image}
                    <div
                        class="flex items-center justify-center h-48 bg-muted rounded-md"
                    >
                        <div class="loader"></div>
                    </div>
                {:else}
                    <div
                        class="flex items-center justify-center h-48 bg-muted rounded-md"
                    >
                        <Image
                            class="h-10 w-10 text-muted-foreground opacity-50"
                        />
                    </div>
                {/if}

                <div class="metadata space-y-3 mt-4">
                    <div class="flex items-center gap-2">
                        <Tag class="h-4 w-4 text-primary" />
                        <span class="text-sm font-medium">Category:</span>
                        <Badge>{formatTag(selectedEntry.tag)}</Badge>
                    </div>

                    <div class="flex items-center gap-2">
                        <Calendar class="h-4 w-4 text-primary" />
                        <span class="text-sm font-medium">Date:</span>
                        <span class="text-sm"
                            >{formatDateTime(selectedEntry.date)}</span
                        >
                    </div>

                    <div class="flex items-center gap-2">
                        <Clock class="h-4 w-4 text-primary" />
                        <span class="text-sm font-medium">Added:</span>
                        <span class="text-sm"
                            >{formatDateTime(selectedEntry.created)}</span
                        >
                    </div>

                    {#if showMetadata}
                        <div class="mt-4 pt-4 border-t border-muted">
                            <div
                                class="text-xs text-muted-foreground space-y-2"
                            >
                                <div class="flex items-center justify-between">
                                    <span class="font-medium">Entry ID:</span>
                                    <code class="bg-muted px-2 py-1 rounded"
                                        >{selectedEntry.id}</code
                                    >
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="font-medium"
                                        >Last Updated:</span
                                    >
                                    <span
                                        >{formatDateTime(
                                            selectedEntry.updated,
                                        )}</span
                                    >
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="font-medium">Has Image:</span>
                                    <Badge
                                        variant={selectedEntry.image
                                            ? "default"
                                            : "secondary"}
                                    >
                                        {selectedEntry.image ? "Yes" : "No"}
                                    </Badge>
                                </div>
                                {#if selectedEntry.image}
                                    <div
                                        class="flex items-start justify-between"
                                    >
                                        <span class="font-medium"
                                            >Image File:</span
                                        >
                                        <code
                                            class="bg-muted px-2 py-1 rounded text-xs max-w-[200px] truncate"
                                        >
                                            {selectedEntry.image}
                                        </code>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}

        <Dialog.Footer>
            <div class="flex justify-between w-full">
                <Button variant="outline" onclick={() => (detailsOpen = false)}
                    >Close</Button
                >
                {#if selectedEntry}
                    <div class="flex gap-2">
                        <Button
                            variant="secondary"
                            onclick={() => handleEdit(selectedEntry!)}
                        >
                            Edit
                        </Button>
                        <Button
                            variant="destructive"
                            onclick={() => {
                                if (selectedEntry) {
                                    confirmDelete(selectedEntry);
                                    detailsOpen = false;
                                }
                            }}
                        >
                            Delete
                        </Button>
                    </div>
                {/if}
            </div>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<!-- Confirm Delete Dialog -->
<Dialog.Root bind:open={confirmDeleteOpen}>
    <Dialog.Content class="sm:max-w-[400px]">
        <Dialog.Header>
            <Dialog.Title>Confirm Deletion</Dialog.Title>
            <Dialog.Description>
                {#if entryToDelete}
                    Are you sure you want to delete "{entryToDelete.name}"?
                {:else}
                    Are you sure you want to delete this entry?
                {/if}
                <p class="text-sm text-destructive mt-2">
                    This action cannot be undone.
                </p>
            </Dialog.Description>
        </Dialog.Header>

        <Dialog.Footer>
            <Button
                variant="outline"
                onclick={() => (confirmDeleteOpen = false)}>Cancel</Button
            >
            <Button variant="destructive" onclick={handleDelete}>Delete</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<style>
    /* ✅ FIXED: Loader now works in dark mode */
    .loader {
        width: 2rem;
        height: 2rem;
        border: 3px solid hsl(var(--muted-foreground) / 0.2);
        border-radius: 50%;
        border-top-color: hsl(var(--primary));
        animation: spin 1s ease-in-out infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .image-loading-placeholder {
        background-color: hsl(var(--muted));
        aspect-ratio: 1 / 1;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .photo-item {
        position: relative;
        aspect-ratio: 1 / 1;
        overflow: hidden;
        border-radius: 0.5rem;
        transition: transform 0.2s;
    }

    .photo-item:hover {
        transform: scale(1.02);
    }

    .photo-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .photo-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.8),
            rgba(0, 0, 0, 0)
        );
        padding: 1rem;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .photo-item:hover .photo-overlay {
        opacity: 1;
    }

    .photo-info {
        color: white;
    }

    .photo-title {
        font-weight: 600;
        font-size: 0.875rem;
        margin-bottom: 0.25rem;
    }

    .photo-meta {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
    }

    .photo-time {
        opacity: 0.9;
    }
</style>

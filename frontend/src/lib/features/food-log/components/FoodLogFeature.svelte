<script lang="ts">
	import FoodLogUpload from "$lib/features/food-log/components/FoodLogUpload.svelte";
	import FoodLogEntries from "$lib/features/food-log/components/FoodLogEntries.svelte";
	import { FoodLogService } from "$lib/features/food-log/services/food-log.service";
	import { FoodLogSyncService } from "$lib/features/food-log/services/food-log-sync.service.svelte";
	import {
		FOOD_LOG_PAGE_SIZE,
		SEARCH_DEBOUNCE_MS,
		MEAL_SECTIONS,
	} from "$lib/features/food-log/constants";
	import type {
		FoodLogEntry,
		FoodLogFormData,
		FoodLogFilter,
	} from "$lib/features/food-log/types";
	import { Button } from "$lib/components/ui/button";
	import SearchInput from "$lib/components/SearchInput.svelte";
	import { Plus, Upload } from "lucide-svelte";
	import * as Card from "$lib/components/ui/card";
	import * as Dialog from "$lib/components/ui/dialog";
	import { onMount } from "svelte";
	import { FileService } from "$lib/services/file-token";
	import { Badge } from "$lib/components/ui/badge";
	import { toast } from "svelte-sonner";
	import { DebugSettings, createPageDebug } from "$lib/utils/debug-helper";
	import { withErrorHandling } from "$lib/utils/error-handler.util";
	import { DateUtil } from "$lib/utils/date.util";
	import { useModalState, useDebouncedFilter } from "$lib/hooks";
	import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
	import EmptyState from "$lib/components/EmptyState.svelte";
	import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
	import ButtonControl from "$lib/components/debug/controls/ButtonControl.svelte";
	import SwitchControl from "$lib/components/debug/controls/SwitchControl.svelte";

	// Debug settings with automatic localStorage management
	const debugSettings = new DebugSettings("foodLogDebugSettings", {
		showImages: true,
		showMetadata: false,
	});

	// Reactive state for template usage
	let showImages = $state(debugSettings.get("showImages"));
	let showMetadata = $state(debugSettings.get("showMetadata"));

	// Component State
	let entries = $state<FoodLogEntry[]>([]);
	let isLoading = $state(true);
	let hasMore = $state(true);
	let page = $state(1);
	let filter = $state<FoodLogFilter>({ searchTerm: "" });
	let mealImages = $state<Record<string, string>>({});

	// UI State - Modal Management with useModalState
	const modals = useModalState<FoodLogEntry>();
	let currentMealType = $state("");

	// Derived State - Today's meals for quick view
	// ✅ FIXED: Removed function wrapper for proper reactivity
	const todaysMeals = $derived.by(() => {
		const todayStr = new Date().toISOString().split("T")[0];
		const meals: Record<string, FoodLogEntry | null> = {
			breakfast: null,
			lunch: null,
			dinner: null,
		};

		for (const entry of entries) {
			if (entry.date.startsWith(todayStr)) {
				// Keep the most recent entry for each meal type
				if (
					meals[entry.tag] === null ||
					new Date(entry.date) > new Date(meals[entry.tag]!.date)
				) {
					meals[entry.tag] = entry;
				}
			}
		}

		return meals;
	});

	// Data Fetching and Management
	async function loadEntries(reset = false) {
		// Prevent concurrent loads unless explicitly resetting
		if (isLoading && !reset) return;

		isLoading = true;

		if (reset) {
			page = 1;
			entries = [];
			hasMore = true;
		}

		try {
			const result = await FoodLogService.getEntries(
				page,
				FOOD_LOG_PAGE_SIZE,
				filter,
			);

			const newEntries = result.items;
			entries = reset ? newEntries : [...entries, ...newEntries];
			page += 1;
			hasMore = result.hasMore;

			// Load images for new entries
			await loadMealImages(newEntries);
		} catch (error) {
			console.error("Error loading entries:", error);
			toast.error("Failed to load food log entries");
		} finally {
			isLoading = false;
		}
	}

	// ✅ FIXED: Parallel image loading (10x faster)
	// ✅ OFFLINE-FIRST: Load from local blob storage or server
	async function loadMealImages(entriesToLoad: FoodLogEntry[]) {
		const imagePromises = entriesToLoad
			.filter((entry) => entry.image)
			.map(async (entry) => {
				try {
					// Try to get image URL (async, handles local + server)
					const imageUrl = await FoodLogService.getImageUrl(entry);

					// If it's a blob URL (local), return directly
					if (imageUrl.startsWith("blob:")) {
						return { id: entry.id, url: imageUrl };
					}

					// Otherwise, get authenticated URL from server
					const url =
						await FileService.getAuthenticatedFileUrl(imageUrl);
					return { id: entry.id, url };
				} catch (error) {
					console.error(
						`Failed to load image for entry ${entry.id}:`,
						error,
					);
					return { id: entry.id, url: null };
				}
			});

		const results = await Promise.allSettled(imagePromises);

		// Build new images object
		const newImages = { ...mealImages };
		results.forEach((result) => {
			if (
				result.status === "fulfilled" &&
				result.value &&
				result.value.url
			) {
				newImages[result.value.id] = result.value.url;
			}
		});

		// Update state once
		mealImages = newImages;
	}

	// Refresh a single image with a new token (for token expiry handling)
	async function refreshSingleImage(entryId: string) {
		console.log(`Refreshing image for entry ${entryId} with new token...`);

		const entry = entries.find((e) => e.id === entryId);
		if (!entry || !entry.image) {
			console.warn(
				`Cannot refresh image: Entry ${entryId} not found or has no image`,
			);
			return;
		}

		try {
			// Get the base image URL
			const imageUrl = await FoodLogService.getImageUrl(entry);

			// If it's a blob URL (local), no need to refresh
			if (imageUrl.startsWith("blob:")) {
				return;
			}

			// Get a fresh authenticated URL (this will fetch a new token if needed)
			const freshUrl =
				await FileService.getAuthenticatedFileUrl(imageUrl);

			// Update the image URL
			mealImages = { ...mealImages, [entryId]: freshUrl };
			console.log(`Successfully refreshed image for entry ${entryId}`);
		} catch (error) {
			console.error(
				`Failed to refresh image for entry ${entryId}:`,
				error,
			);
		}
	}

	function openUploadModal(mealType: string) {
		currentMealType = mealType;
		modals.openCreate();
	}

	async function handleUploadSubmit(e: CustomEvent<FoodLogFormData>) {
		const formData = e.detail;

		await withErrorHandling(() => FoodLogService.createEntry(formData), {
			successMessage: "Food log entry added successfully!",
			errorMessage: "Failed to save food log entry",
			onSuccess: async () => {
				modals.closeCreate();
				await loadEntries(true);
			},
		});
	}

	async function handleDelete(e: CustomEvent<string>) {
		const entryId = e.detail;

		await withErrorHandling(() => FoodLogService.deleteEntry(entryId), {
			successMessage: "Food log entry deleted successfully!",
			errorMessage: "Failed to delete food log entry",
			onSuccess: () => {
				// Remove from local state
				entries = entries.filter((entry) => entry.id !== entryId);

				// Clean up image URL
				if (mealImages[entryId]) {
					delete mealImages[entryId];
				}
			},
		});
	}

	function handleEdit(e: CustomEvent<FoodLogEntry>) {
		modals.openEdit(e.detail);
	}

	async function handleEditSubmit(
		e: CustomEvent<FoodLogFormData & { id?: string }>,
	) {
		const formData = e.detail;

		if (!formData.id) {
			toast.error("Entry ID is missing");
			return;
		}

		await withErrorHandling(
			() =>
				FoodLogService.updateEntry(formData.id!, {
					name: formData.name,
					tag: formData.tag,
					date: formData.date,
					image: formData.image,
				}),
			{
				successMessage: "Food log entry updated successfully!",
				errorMessage: "Failed to update food log entry",
				onSuccess: async (updated) => {
					// Update local state
					entries = entries.map((entry) =>
						entry.id === formData.id ? updated : entry,
					);

					// Reload image if changed
					if (formData.image) {
						await loadMealImages([updated]);
					}

					modals.closeEdit();
				},
			},
		);
	}

	onMount(() => {
		loadEntries(true);

		// Listen for sync events to refresh content
		const handleSyncComplete = () => {
			console.log("🔄 Sync complete, refreshing food log...");
			loadEntries(true);
		};

		window.addEventListener("food-log-synced", handleSyncComplete);

		// Register debug controls with fluent API
		const cleanup = createPageDebug(
			"food-log-page-controls",
			"Food Log Options",
		)
			.addButton("refresh-entries", "Refresh Entries", () =>
				loadEntries(true),
			)
			.addButton("clear-filters", "Clear Filters", () => {
				filter = {};
				loadEntries(true);
			})
			.addButton("force-sync", "Force Sync Now", () => {
				FoodLogSyncService.forceSyncNow();
			})
			.addButton("clear-cache", "Clear Local Cache", async () => {
				await FoodLogService.clearLocalCache();
				toast.success("Local cache cleared");
			})
			.addButton("show-stats", "Show Storage Stats", async () => {
				const stats = await FoodLogService.getStorageStats();
				toast.info(
					`Storage: ${stats.totalEntries} entries, ${stats.pendingEntries} pending, ${stats.cachedImages} images`,
				);
			})
			.addSwitch("show-images", "Show Images", showImages, (checked) => {
				showImages = checked;
				debugSettings.update("showImages", checked);
			})
			.addSwitch(
				"show-metadata",
				"Show Entry Metadata",
				showMetadata,
				(checked) => {
					showMetadata = checked;
					debugSettings.update("showMetadata", checked);
				},
			)
			.register({
				ButtonControl: ButtonControl as any,
				SwitchControl: SwitchControl as any,
				SelectControl: null as any,
			});

		return () => {
			cleanup();
			window.removeEventListener("food-log-synced", handleSyncComplete);
		};
	});

	// Debounced search
	// Debounced filter - using reusable hook
	useDebouncedFilter(
		() => filter,
		() => loadEntries(true),
		SEARCH_DEBOUNCE_MS,
	);
</script>

<div class="food-log-floating-layout">
	<!-- Top: Search and Filters -->
	<div class="food-log-top-card">
		<Card.Root class="food-log-search-card">
			<Card.Content class="p-4">
				<div class="page-header mb-4">
					<h1 class="text-3xl font-bold">Food Log</h1>
					<p class="text-muted-foreground mt-2">Track your daily meals</p>
				</div>
				<SearchInput
					bind:value={filter.searchTerm}
					placeholder="Search food items..."
				/>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Today's Meals Section -->
	<div class="food-log-meals-card-wrapper">
		<Card.Root class="food-log-meals-card">
			<Card.Header>
				<Card.Title>Today's Meals</Card.Title>
			</Card.Header>
			<Card.Content class="p-4">
				<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
					{#each MEAL_SECTIONS as meal}
						<Card.Root>
							<Card.Header
								class={todaysMeals[meal.id]
									? "bg-primary/20 text-primary border-primary/30"
									: "bg-muted text-muted-foreground border-border"}
							>
								<div class="flex justify-between items-center">
									<Card.Title class="text-base">{meal.label}</Card.Title>
									<Badge
										variant={todaysMeals[meal.id]
											? "default"
											: "outline"}
									>
										{todaysMeals[meal.id] ? "Logged" : "Not Logged"}
									</Badge>
								</div>
							</Card.Header>
							<Card.Content class="p-4">
								{#if todaysMeals[meal.id]}
									<div>
										{#if todaysMeals[meal.id]?.image && mealImages[todaysMeals[meal.id]!.id]}
											<img
												src={mealImages[
													todaysMeals[meal.id]!.id
												]}
												alt={todaysMeals[meal.id]!.name}
												class="w-full h-32 object-cover rounded-md mb-2"
											/>
										{/if}
										<h4 class="font-medium">
											{todaysMeals[meal.id]?.name}
										</h4>
										<Button
											variant="ghost"
											size="sm"
											class="w-full mt-2"
											on:click={() => openUploadModal(meal.id)}
										>
											<Plus class="h-4 w-4 mr-2" /> Add Another
										</Button>
									</div>
								{:else}
									<button
										class="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer w-full text-left hover:bg-accent/50 transition-colors"
										onclick={() => openUploadModal(meal.id)}
									>
										<Upload
											class="h-10 w-10 text-muted-foreground mb-2"
										/>
										<p class="text-sm text-muted-foreground">
											Upload your {meal.label}
										</p>
									</button>
								{/if}
							</Card.Content>
						</Card.Root>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Entries List -->
	<div class="food-log-entries-card-wrapper">
		<Card.Root class="food-log-entries-card">
			<Card.Content class="p-4">
				<FoodLogEntries
					{entries}
					{mealImages}
					{showImages}
					{showMetadata}
					on:delete={handleDelete}
					on:edit={handleEdit}
					on:refreshImage={(e) => refreshSingleImage(e.detail)}
				/>

				{#if hasMore && !isLoading}
					<div class="flex justify-center mt-8">
						<Button on:click={() => loadEntries()} variant="outline">
							Load More
						</Button>
					</div>
				{/if}

				{#if isLoading}
					<LoadingSpinner centered size="lg" class="mt-8" />
				{/if}

				{#if !isLoading && entries.length === 0}
					<EmptyState
						icon={Upload}
						title="No food entries yet"
						description="Start logging your meals to track your nutrition"
						actionLabel="Add First Entry"
						onaction={() => modals.openCreate()}
					/>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>

<!-- Upload Dialog -->
<!-- ✅ FIXED: Better mobile support with max height and scroll -->
<Dialog.Root bind:open={modals.createModalOpen}>
	<Dialog.Content class="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Add {currentMealType || "Food Entry"}</Dialog.Title>
		</Dialog.Header>
		<FoodLogUpload
			initialTag={currentMealType}
			mode="create"
			on:submit={handleUploadSubmit}
		/>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit Dialog -->
<Dialog.Root bind:open={modals.editModalOpen}>
	<Dialog.Content class="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Edit Food Entry</Dialog.Title>
		</Dialog.Header>
		<FoodLogUpload
			mode="edit"
			editEntry={modals.selectedItem}
			on:submit={handleEditSubmit}
		/>
	</Dialog.Content>
</Dialog.Root>

<style>
	.food-log-floating-layout {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		max-width: 80rem; /* 7xl */
		margin: 0 auto;
		width: 100%;
	}

	.food-log-top-card {
		flex-shrink: 0;
		z-index: 10;
	}

	.food-log-meals-card-wrapper {
		flex-shrink: 0;
	}

	.food-log-entries-card-wrapper {
		flex-shrink: 0;
	}

	.food-log-search-card {
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	.food-log-meals-card {
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	.food-log-entries-card {
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}
</style>

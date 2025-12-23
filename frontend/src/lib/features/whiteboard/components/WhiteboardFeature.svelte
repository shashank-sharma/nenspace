<script lang="ts">
	import WhiteboardCanvas from "./WhiteboardCanvas.svelte";
	import WhiteboardSaveDialog from "./WhiteboardSaveDialog.svelte";
	import WhiteboardListModal from "./WhiteboardListModal.svelte";
	import { WhiteboardService } from "../services";
	import { WHITEBOARD_PAGE_SIZE } from "../constants";
	import type {
		WhiteboardEntry,
		WhiteboardFormData,
		ExcalidrawContent,
		ExcalidrawInitialDataState,
	} from "../types";
	import { onMount, onDestroy } from "svelte";
	import { toast } from "svelte-sonner";
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { DebugSettings, createPageDebug } from "$lib/utils/debug-helper";
	import { withErrorHandling } from "$lib/utils/error-handler.util";
	import { NetworkService } from "$lib/services/network.service.svelte";
	import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
	import ButtonControl from "$lib/components/debug/controls/ButtonControl.svelte";
	import SwitchControl from "$lib/components/debug/controls/SwitchControl.svelte";
	import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types.js";
	import { browser } from "$app/environment";

	const debugSettings = new DebugSettings("whiteboardDebugSettings", {
		showMetadata: false,
		showAutosaveStatus: false,
		verboseLogging: false,
		simulateOffline: false,
	});

	// localStorage keys
	const DRAFT_STORAGE_KEY = "whiteboard_draft";
	const THUMBNAIL_TIMESTAMP_KEY = "whiteboard_thumbnail_timestamps";
	
	// Thumbnail generation interval (30 minutes in milliseconds)
	const THUMBNAIL_UPDATE_INTERVAL = 30 * 60 * 1000;

	// Draft metadata interface
	interface DraftMetadata {
		whiteboardId: string | null; // null for new whiteboard, ID for existing
		timestamp: number; // Date.now() when draft was saved
		content: ExcalidrawContent;
	}

	let showMetadata = $state(debugSettings.get("showMetadata"));
	let showAutosaveStatus = $state(debugSettings.get("showAutosaveStatus"));
	let verboseLogging = $state(debugSettings.get("verboseLogging"));
	let simulateOffline = $state(debugSettings.get("simulateOffline"));

	// Whiteboard entries for floating cards
	let entries = $state<WhiteboardEntry[]>([]);
	let isLoading = $state(true);
	let isLoadingEntries = $state(false);

	// Current whiteboard state
	let currentWhiteboard = $state<WhiteboardEntry | null>(null);
	let canvasInitialData = $state<ExcalidrawInitialDataState | null>(null);
	let excalidrawAPI = $state<ExcalidrawImperativeAPI | undefined>(undefined);
	let canvasRef = $state<WhiteboardCanvas | null>(null);
	let hasUnsavedChanges = $state(false);
	let isCanvasFullyLoaded = $state(false);

	// UI state
	let saveDialogOpen = $state(false);
	let discardConfirmOpen = $state(false);
	let pendingAction = $state<(() => void) | null>(null);
	let isSaving = $state(false);
	let isAutoSaving = $state(false);
	let listModalOpen = $state(false);
	let justSaved = $state(false); // Flag to prevent change events right after save
	
	// Autosave
	let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
	
	// Debounced localStorage save timer
	let localStorageSaveTimer: ReturnType<typeof setTimeout> | null = null;

	// Auto-naming counter
	let untitledCounter = $state(1);

	function generateDefaultTitle(): string {
		const existingTitles = entries.map((e) => e.title).filter((t) => t.startsWith("Untitled Whiteboard"));
		if (existingTitles.length === 0) return "Untitled Whiteboard";
		
		const numbers = existingTitles
			.map((t) => {
				const match = t.match(/Untitled Whiteboard(?: (\d+))?/);
				return match ? (match[1] ? parseInt(match[1]) : 1) : 0;
			})
			.filter((n) => n > 0);
		
		const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
		return `Untitled Whiteboard ${maxNumber + 1}`;
	}

	async function loadEntries() {
		// Prevent concurrent calls
		if (isLoadingEntries) {
			return;
		}
		
		isLoadingEntries = true;
		isLoading = true;
		try {
			const result = await WhiteboardService.getEntries(1, WHITEBOARD_PAGE_SIZE);
			entries = result.items;
		} catch (error: any) {
			// Don't show error for auto-cancelled requests (happens during rapid navigation)
			if (error?.status !== 0 && error?.isAbort !== true) {
				console.error("Failed to load whiteboard entries:", error);
				toast.error("Failed to load whiteboards");
			}
		} finally {
			isLoading = false;
			isLoadingEntries = false;
		}
	}

	function startNewWhiteboard() {
		// Reset loading state when starting new whiteboard
		isCanvasFullyLoaded = false;
		
		currentWhiteboard = null;
		hasUnsavedChanges = false;
		cancelAutosave();
		cancelLocalStorageSave();
		
		// Try to load draft from localStorage (only for new whiteboards)
		const draft = loadDraftFromLocalStorage();
		// Only use draft if it's for a new whiteboard (whiteboardId is null)
		canvasInitialData = draft && draft.whiteboardId === null ? {
			elements: draft.content.elements,
			appState: draft.content.appState,
		} : null;
		
		// Update URL to base whiteboard route
		goto("/dashboard/whiteboard", { replaceState: false, noScroll: true });
		
		// Load draft content if available, otherwise clear canvas
		if (canvasRef && excalidrawAPI) {
			canvasRef.loadContent(canvasInitialData);
		}
	}

	function checkUnsavedChanges(action: () => void): void {
		// Only show discard confirmation if there are unsaved changes AND elements to lose
		const hasElements = canvasRef?.hasElements() ?? false;
		
		if (hasUnsavedChanges && hasElements && canvasRef) {
			pendingAction = action;
			discardConfirmOpen = true;
		} else {
			// No unsaved changes or no elements, proceed immediately
			action();
		}
	}

	function handleDiscardConfirm() {
		if (pendingAction) {
			pendingAction();
			pendingAction = null;
		}
		discardConfirmOpen = false;
		hasUnsavedChanges = false;
	}

	function handleDiscardCancel() {
		discardConfirmOpen = false;
		pendingAction = null;
	}

	async function loadWhiteboard(entry: WhiteboardEntry) {
		checkUnsavedChanges(async () => {
			// Reset loading state when switching whiteboards
			isCanvasFullyLoaded = false;
			
			// Cancel any pending autosave and localStorage saves before loading new whiteboard
			cancelAutosave();
			cancelLocalStorageSave();
			
			// Check localStorage for draft and resolve conflicts
			const draft = loadDraftFromLocalStorage();
			const resolved = await compareAndResolveDraft(entry, draft);
			
			currentWhiteboard = entry;
			
			// Update URL with slug
			if (entry.slug) {
				goto(`/dashboard/whiteboard/${entry.slug}`, { replaceState: false, noScroll: true });
			}
			
			// Use resolved content
			canvasInitialData = resolved.content;
			
			// Reset unsaved state before loading - this prevents autosave from triggering
			hasUnsavedChanges = false;
			
			// Auto-save if localStorage was newer
			if (resolved.shouldAutoSave && resolved.content) {
				try {
					// Silent save to backend
					const formData: WhiteboardFormData = {
						title: entry.title,
						description: entry.description,
						tags: entry.tags,
						content: resolved.content,
					};
					const savedEntry = await WhiteboardService.updateEntry(entry.id, formData);
					
					// Update current whiteboard with saved entry
					currentWhiteboard = savedEntry;
					entries = entries.map((e) => (e.id === savedEntry.id ? savedEntry : e));
					
					// Clear localStorage after successful save
					clearDraftFromLocalStorage();
					
					// Show notification
					toast.success("Restored unsaved changes");
				} catch (error) {
					console.error("[WhiteboardFeature] Failed to auto-save restored draft:", error);
					toast.error("Failed to save restored changes");
				}
			}
			
			// Load content into existing Excalidraw instance if API is ready
			// If API is not ready yet, the initialData prop will handle it on mount
			if (canvasRef && excalidrawAPI) {
				canvasRef.loadContent(canvasInitialData);
				// Wait for content to load and settle, then ensure it's marked as saved
				setTimeout(() => {
					if (canvasRef) {
						canvasRef.markSaved();
						hasUnsavedChanges = false;
					}
				}, 700);
			} else if (canvasRef) {
				// API not ready yet, try again after a short delay
				setTimeout(() => {
					if (canvasRef && excalidrawAPI) {
						canvasRef.loadContent(canvasInitialData);
						setTimeout(() => {
							if (canvasRef) {
								canvasRef.markSaved();
								hasUnsavedChanges = false;
							}
						}, 700);
					}
				}, 100);
			}
		});
	}

	function handleNewWhiteboard() {
		checkUnsavedChanges(() => {
			startNewWhiteboard();
		});
	}

	function handleSelectWhiteboard(entry: WhiteboardEntry) {
		loadWhiteboard(entry);
	}

	function handleCanvasChange(content: ExcalidrawContent | null, hasChanges: boolean) {
		if (justSaved) {
			return;
		}

		if (localStorageSaveTimer) {
			clearTimeout(localStorageSaveTimer);
		}
		
		if (content) {
			const whiteboardId = currentWhiteboard?.id || null;
			localStorageSaveTimer = setTimeout(() => {
				saveDraftToLocalStorage(content, whiteboardId);
				localStorageSaveTimer = null;
			}, 300);
		}
		
		if (!currentWhiteboard) {
			hasUnsavedChanges = false;
			cancelAutosave();
			return;
		}
		
		const hasElements = content && Array.isArray(content.elements) && content.elements.length > 0;
		const shouldBeUnsaved = hasChanges && hasElements;
		
		if (hasUnsavedChanges !== shouldBeUnsaved) {
			hasUnsavedChanges = shouldBeUnsaved;
		}
		
		if (currentWhiteboard && hasUnsavedChanges && hasElements && !isSaving && !isAutoSaving) {
			scheduleAutosave();
		} else {
			cancelAutosave();
		}
	}

	function saveDraftToLocalStorage(content: ExcalidrawContent | null, whiteboardId: string | null = null) {
		if (!browser) return;
		
		try {
			if (content && Array.isArray(content.elements) && content.elements.length > 0) {
				const draft: DraftMetadata = {
					whiteboardId,
					timestamp: Date.now(),
					content,
				};
				localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
			} else {
				// Remove draft if empty
				localStorage.removeItem(DRAFT_STORAGE_KEY);
			}
		} catch (e) {
			console.error("[WhiteboardFeature] Failed to save draft to localStorage:", e);
		}
	}

	function loadDraftFromLocalStorage(): DraftMetadata | null {
		if (!browser) return null;
		
		try {
			const draftStr = localStorage.getItem(DRAFT_STORAGE_KEY);
			if (draftStr) {
				const parsed = JSON.parse(draftStr);
				
				// Handle migration from old format (content only) to new format (with metadata)
				if (!parsed.timestamp) {
					// Old format - migrate to new format
					const migrated: DraftMetadata = {
						whiteboardId: null, // Assume new whiteboard
						timestamp: Date.now(), // Use current timestamp
						content: {
							elements: parsed.elements || [],
							appState: parsed.appState || {},
						},
					};
					// Save migrated version
					localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(migrated));
					return migrated;
				}
				
				// New format - return as is
				return {
					whiteboardId: parsed.whiteboardId ?? null,
					timestamp: parsed.timestamp,
					content: parsed.content,
				};
			}
		} catch (e) {
			console.error("[WhiteboardFeature] Failed to load draft from localStorage:", e);
			localStorage.removeItem(DRAFT_STORAGE_KEY);
		}
		return null;
	}

	function clearDraftFromLocalStorage() {
		if (!browser) return;
		try {
			localStorage.removeItem(DRAFT_STORAGE_KEY);
		} catch (e) {
			console.error("[WhiteboardFeature] Failed to clear draft from localStorage:", e);
		}
	}

	// Thumbnail generation tracking
	function getThumbnailTimestamps(): Record<string, number> {
		if (!browser) return {};
		try {
			const stored = localStorage.getItem(THUMBNAIL_TIMESTAMP_KEY);
			return stored ? JSON.parse(stored) : {};
		} catch (e) {
			console.error("[WhiteboardFeature] Failed to get thumbnail timestamps:", e);
			return {};
		}
	}

	function setThumbnailTimestamp(whiteboardId: string) {
		if (!browser) return;
		try {
			const timestamps = getThumbnailTimestamps();
			timestamps[whiteboardId] = Date.now();
			localStorage.setItem(THUMBNAIL_TIMESTAMP_KEY, JSON.stringify(timestamps));
		} catch (e) {
			console.error("[WhiteboardFeature] Failed to set thumbnail timestamp:", e);
		}
	}

	function shouldGenerateThumbnail(whiteboardId: string, existingThumbnail: string | null | undefined): boolean {
		if (!existingThumbnail || existingThumbnail.trim() === "") {
			// No thumbnail exists, generate it
			return true;
		}

		// Check timestamp from localStorage
		const timestamps = getThumbnailTimestamps();
		const lastGenerated = timestamps[whiteboardId];

		if (!lastGenerated) {
			// No timestamp recorded, generate it
			return true;
		}

		// Check if 30 minutes have passed
		const timeSinceLastUpdate = Date.now() - lastGenerated;
		return timeSinceLastUpdate >= THUMBNAIL_UPDATE_INTERVAL;
	}

	async function generateThumbnail(
		content: ExcalidrawContent,
		whiteboardId: string
	): Promise<File | null> {
		if (!browser) return null;

		try {
			// Dynamically import exportToBlob to avoid loading it if not needed
			const { exportToBlob } = await import("@excalidraw/excalidraw");

			const blob = await exportToBlob({
				elements: content.elements,
				appState: {
					...content.appState,
					exportBackground: true,
					exportWithDarkMode: content.appState.theme === "dark",
				},
				mimeType: "image/png",
				getDimensions: (width: number, height: number) => {
					// Generate thumbnail at 16:9 aspect ratio (1920x1080 format)
					// Use a reasonable size for thumbnails while maintaining quality
					const targetWidth = 1280;
					const targetHeight = 720; // 16:9 ratio
					const targetAspectRatio = targetWidth / targetHeight;

					// Calculate the actual aspect ratio of the content
					const contentAspectRatio = width / height;

					if (contentAspectRatio > targetAspectRatio) {
						// Content is wider than 16:9, fit to width
						return {
							width: targetWidth,
							height: Math.round(targetWidth / contentAspectRatio),
						};
					} else {
						// Content is taller than 16:9, fit to height
						return {
							width: Math.round(targetHeight * contentAspectRatio),
							height: targetHeight,
						};
					}
				},
			});

			// Convert blob to File object
			const file = new File([blob], `whiteboard-thumbnail-${whiteboardId}.png`, {
				type: "image/png",
			});

			return file;
		} catch (error) {
			console.error("[WhiteboardFeature] Failed to generate thumbnail:", error);
			return null;
		}
	}

	async function compareAndResolveDraft(
		entry: WhiteboardEntry,
		draft: DraftMetadata | null
	): Promise<{ content: ExcalidrawInitialDataState | null; shouldAutoSave: boolean }> {
		// If no draft, use backend entry
		if (!draft) {
			return {
				content: entry.content ? {
					elements: entry.content.elements,
					appState: entry.content.appState,
				} : null,
				shouldAutoSave: false,
			};
		}

		// Check if draft belongs to this whiteboard
		if (draft.whiteboardId !== entry.id) {
			// Draft belongs to different whiteboard, clear it
			clearDraftFromLocalStorage();
			return {
				content: entry.content ? {
					elements: entry.content.elements,
					appState: entry.content.appState,
				} : null,
				shouldAutoSave: false,
			};
		}

		// Same whiteboard - compare timestamps
		const backendTimestamp = new Date(entry.updated).getTime();
		const draftTimestamp = draft.timestamp;

		if (draftTimestamp > backendTimestamp) {
			// localStorage is newer - use draft and auto-save
			return {
				content: {
					elements: draft.content.elements,
					appState: draft.content.appState,
				},
				shouldAutoSave: true,
			};
		} else {
			// Backend is newer - clear localStorage and use backend
			clearDraftFromLocalStorage();
			return {
				content: entry.content ? {
					elements: entry.content.elements,
					appState: entry.content.appState,
				} : null,
				shouldAutoSave: false,
			};
		}
	}
	
	function scheduleAutosave() {
		// Clear existing timer
		if (autosaveTimer) {
			clearTimeout(autosaveTimer);
		}
		
		// Schedule new autosave after 3 seconds
		autosaveTimer = setTimeout(() => {
			performAutosave();
		}, 3000);
	}
	
	function cancelAutosave() {
		if (autosaveTimer) {
			clearTimeout(autosaveTimer);
			autosaveTimer = null;
		}
	}
	
	function cancelLocalStorageSave() {
		if (localStorageSaveTimer) {
			clearTimeout(localStorageSaveTimer);
			localStorageSaveTimer = null;
		}
	}
	
	async function performAutosave() {
		// Only autosave if conditions are met
		// Don't autosave if manual save is in progress or already autosaving
		if (!currentWhiteboard || !hasUnsavedChanges || isSaving || isAutoSaving) {
			return;
		}
		
		const hasElements = canvasRef?.hasElements() ?? false;
		if (!hasElements) {
			return;
		}
		
		// Get content from canvas
		const content = canvasRef?.getContent();
		if (!content) {
			return;
		}
		
		// Double-check we still have unsaved changes before saving
		if (!hasUnsavedChanges) {
			return;
		}
		
		isAutoSaving = true;
		
		try {
			// Get current entry data
			const formData: WhiteboardFormData = {
				title: currentWhiteboard.title,
				description: currentWhiteboard.description,
				tags: currentWhiteboard.tags,
				content,
			};
			
			// Generate thumbnail if needed (only if there are elements and criteria are met)
			const hasElements = content.elements && content.elements.length > 0;
			if (hasElements && shouldGenerateThumbnail(currentWhiteboard.id, currentWhiteboard.thumbnail)) {
				try {
					const thumbnail = await generateThumbnail(content, currentWhiteboard.id);
					if (thumbnail) {
						formData.thumbnail = thumbnail;
						setThumbnailTimestamp(currentWhiteboard.id);
					}
				} catch (error) {
					console.error("[WhiteboardFeature] Failed to generate thumbnail during autosave:", error);
					// Don't fail autosave if thumbnail generation fails
				}
			}
			// If we're not regenerating, don't include thumbnail in formData
			// (PocketBase will keep the existing file)
			
			// Silent save - no toast notification
			const savedEntry = await WhiteboardService.updateEntry(currentWhiteboard.id, formData);
			
			// Update entries list
			entries = entries.map((e) => (e.id === savedEntry.id ? savedEntry : e));
			
			// Set flag to ignore change events BEFORE marking as saved
			// This prevents change detection from immediately marking as unsaved
			justSaved = true;
			
			// Update current whiteboard
			currentWhiteboard = savedEntry;
			
			// Update state FIRST - this ensures the green state shows immediately
			hasUnsavedChanges = false;
			
			// Mark canvas as saved (this may trigger change events, but justSaved will block them)
			if (canvasRef) {
				canvasRef.markSaved();
			}
			
			// Clear the flag after a brief delay to allow change events to resume
			setTimeout(() => {
				justSaved = false;
			}, 1000);
			
			// Clear draft from localStorage since it's now saved
			clearDraftFromLocalStorage();
			
			// Update URL if slug changed
			if (savedEntry.slug && savedEntry.slug !== $page.params.slug) {
				goto(`/dashboard/whiteboard/${savedEntry.slug}`, { replaceState: true, noScroll: true });
			}
		} catch (error) {
			console.error("Autosave failed:", error);
			// Don't show error toast for autosave failures
		} finally {
			isAutoSaving = false;
			autosaveTimer = null;
		}
	}

	function handleSaveClick() {
		saveDialogOpen = true;
	}

	async function handleSave(formData: WhiteboardFormData) {
		// Cancel any pending autosave since we're saving manually
		cancelAutosave();
		
		// Prevent multiple saves
		if (isSaving || isAutoSaving) {
			return;
		}
		
		// Always use canvasRef.getContent() as primary method since it's more reliable
		let content: ExcalidrawContent | null = null;
		
		if (canvasRef) {
			content = canvasRef.getContent();
		}
		
		// Fallback to direct API access if canvasRef doesn't work
		if (!content && excalidrawAPI) {
			try {
				const elements = excalidrawAPI.getSceneElements();
				const appState = excalidrawAPI.getAppState();
				
				if (elements || appState) {
					content = {
						elements: elements || [],
						appState: appState || {},
					};
				}
			} catch (error) {
				console.error("Failed to get content from Excalidraw API:", error);
			}
		}

		// Check if we have valid content (even if empty, it's still valid)
		if (!content || (typeof content !== 'object')) {
			toast.error("Whiteboard is not ready yet. Please wait a moment and try again.");
			return;
		}

		// Even if empty, save it (empty whiteboard is valid)
		formData.content = content;

		isSaving = true;
		saveDialogOpen = false;

		try {
			// Generate thumbnail if needed (only if there are elements)
			const hasElements = content.elements && content.elements.length > 0;
			if (hasElements) {
				const whiteboardId = currentWhiteboard?.id || null;
				const existingThumbnail = currentWhiteboard?.thumbnail || null;
				
				// Only generate thumbnail if criteria are met
				if (whiteboardId && shouldGenerateThumbnail(whiteboardId, existingThumbnail)) {
					try {
						const thumbnail = await generateThumbnail(content, whiteboardId);
						if (thumbnail) {
							formData.thumbnail = thumbnail;
							// Update timestamp after successful generation
							setThumbnailTimestamp(whiteboardId);
						}
					} catch (error) {
						console.error("[WhiteboardFeature] Failed to generate thumbnail, continuing without it:", error);
						// Don't fail the save if thumbnail generation fails
					}
				}
				// If we're not regenerating, don't include thumbnail in formData
				// (PocketBase will keep the existing file)
			}

			let savedEntry: WhiteboardEntry;

			if (currentWhiteboard) {
				// Update existing
				savedEntry = await WhiteboardService.updateEntry(currentWhiteboard.id, formData);
				entries = entries.map((e) => (e.id === savedEntry.id ? savedEntry : e));
				toast.success("Whiteboard saved successfully");
			} else {
				// Create new - generate thumbnail if needed
				// For new whiteboards with elements, always generate thumbnail
				if (hasElements && !formData.thumbnail) {
					try {
						// Use temporary ID for generation, will update timestamp after creation
						const thumbnail = await generateThumbnail(content, "new");
						if (thumbnail) {
							formData.thumbnail = thumbnail;
						}
					} catch (error) {
						console.error("[WhiteboardFeature] Failed to generate thumbnail for new whiteboard:", error);
					}
				}
				
				savedEntry = await WhiteboardService.createEntry(formData);
				entries = [savedEntry, ...entries];
				
				// Set timestamp after successful creation (only if thumbnail was generated)
				if (savedEntry.thumbnail) {
					setThumbnailTimestamp(savedEntry.id);
				}
				
				toast.success("Whiteboard created successfully");
			}

			currentWhiteboard = savedEntry;
			
			// Reset loading state when saving (title might change)
			isCanvasFullyLoaded = false;
			
			// Set flag to ignore change events BEFORE marking as saved
			// This prevents change detection from immediately marking as unsaved
			justSaved = true;
			
			// Update state FIRST - this ensures the green state shows immediately
			hasUnsavedChanges = false;
			
			// Mark canvas as saved (this may trigger change events, but justSaved will block them)
			if (canvasRef) {
				canvasRef.markSaved();
			}
			
			// Clear draft from localStorage since it's now saved
			clearDraftFromLocalStorage();
			
			// Update URL with slug after save
			if (savedEntry.slug) {
				goto(`/dashboard/whiteboard/${savedEntry.slug}`, { replaceState: false, noScroll: true });
			}
			
			// Clear the flag after a brief delay to allow change events to resume
			setTimeout(() => {
				justSaved = false;
			}, 1000);
		} catch (error) {
			console.error("Failed to save whiteboard:", error);
			toast.error("Failed to save whiteboard");
			saveDialogOpen = true; // Reopen dialog on error
		} finally {
			isSaving = false;
		}
	}

	async function handleDelete(entry: WhiteboardEntry) {
		// Don't delete if it's the current whiteboard
		if (currentWhiteboard?.id === entry.id) {
			toast.error("Cannot delete the currently open whiteboard");
			return;
		}

		await withErrorHandling(() => WhiteboardService.deleteEntry(entry.id), {
			successMessage: "Whiteboard deleted successfully",
			errorMessage: "Failed to delete whiteboard",
			onSuccess: () => {
				entries = entries.filter((e) => e.id !== entry.id);
			},
		});
	}

	// Keyboard shortcuts
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === "s") {
			e.preventDefault();
			if (!saveDialogOpen && !discardConfirmOpen) {
				handleSaveClick();
			}
		} else if ((e.metaKey || e.ctrlKey) && e.key === "n") {
			e.preventDefault();
			if (!saveDialogOpen && !discardConfirmOpen) {
				handleNewWhiteboard();
			}
		} else if (e.key === "Escape" && hasUnsavedChanges) {
			// Only handle escape for discarding if there are unsaved changes
			// Otherwise let Excalidraw handle it
			if (!saveDialogOpen && !discardConfirmOpen) {
				handleNewWhiteboard();
			}
		}
	}

	// Before unload warning
	function handleBeforeUnload(e: BeforeUnloadEvent) {
		if (hasUnsavedChanges) {
			e.preventDefault();
			e.returnValue = "";
		}
	}

	$effect(() => {
		if (canvasRef) {
			isCanvasFullyLoaded = canvasRef.getIsFullyLoaded();
			
			const interval = setInterval(() => {
				if (canvasRef) {
					const loaded = canvasRef.getIsFullyLoaded();
					if (loaded !== isCanvasFullyLoaded) {
						isCanvasFullyLoaded = loaded;
					}
				}
			}, 200);
			
			return () => clearInterval(interval);
		}
	});

	onMount(async () => {
		// Load entries first - wait for it to complete
		await loadEntries().catch(() => {
			// Errors are handled in loadEntries, just catch to prevent unhandled promise rejection
		});
		
		// Check if there's a slug in the URL on initial load
		const slug = $page.params.slug;
		if (slug) {
			// Load whiteboard from slug
			WhiteboardService.getEntryBySlug(slug).then(async (entry) => {
				if (entry) {
					// Cancel any autosave and localStorage saves before loading
					cancelAutosave();
					cancelLocalStorageSave();
					
					// Check localStorage for draft and resolve conflicts
					const draft = loadDraftFromLocalStorage();
					const resolved = await compareAndResolveDraft(entry, draft);
					
					// Load without checking unsaved changes since this is initial load
					currentWhiteboard = entry;
					canvasInitialData = resolved.content;
					
					// Set unsaved to false BEFORE loading to prevent false positives
					hasUnsavedChanges = false;
					
					// Auto-save if localStorage was newer
					if (resolved.shouldAutoSave && resolved.content) {
						try {
							// Silent save to backend
							const formData: WhiteboardFormData = {
								title: entry.title,
								description: entry.description,
								tags: entry.tags,
								content: resolved.content,
							};
							const savedEntry = await WhiteboardService.updateEntry(entry.id, formData);
							
							// Update current whiteboard with saved entry
							currentWhiteboard = savedEntry;
							entries = entries.map((e) => (e.id === savedEntry.id ? savedEntry : e));
							
							// Clear localStorage after successful save
							clearDraftFromLocalStorage();
							
							// Show notification
							toast.success("Restored unsaved changes");
						} catch (error) {
							console.error("[WhiteboardFeature] Failed to auto-save restored draft:", error);
							toast.error("Failed to save restored changes");
						}
					}
					
					// Load content when API is ready
					if (canvasRef && excalidrawAPI) {
						canvasRef.loadContent(canvasInitialData);
						// Wait for content to load and settle, then ensure it's marked as saved
						setTimeout(() => {
							if (canvasRef) {
								canvasRef.markSaved();
								hasUnsavedChanges = false;
							}
						}, 700);
					} else if (canvasRef) {
						setTimeout(() => {
							if (canvasRef && excalidrawAPI) {
								canvasRef.loadContent(canvasInitialData);
								setTimeout(() => {
									if (canvasRef) {
										canvasRef.markSaved();
										hasUnsavedChanges = false;
									}
								}, 700);
							}
						}, 100);
					}
				} else {
					// Slug not found, start new
					startNewWhiteboard();
				}
			}).catch((error) => {
				console.error("Failed to load whiteboard from slug:", error);
				startNewWhiteboard();
			});
		} else {
			// No slug - start new, but try to load draft first
			const draft = loadDraftFromLocalStorage();
			// Only use draft if it's for a new whiteboard (whiteboardId is null)
			if (draft && draft.whiteboardId === null) {
				canvasInitialData = {
					elements: draft.content.elements,
					appState: draft.content.appState,
				};
			}
			startNewWhiteboard();
		}

		window.addEventListener("keydown", handleKeydown);
		window.addEventListener("beforeunload", handleBeforeUnload);

		const cleanup = createPageDebug("whiteboard-page-controls", "Whiteboard Options")
			.addButton("refresh-entries", "Refresh Entries", () => loadEntries())
			.addSwitch("show-metadata", "Show Metadata", showMetadata, (checked) => {
				showMetadata = checked;
				debugSettings.update("showMetadata", checked);
			})
			.addSwitch("show-autosave-status", "Show Autosave Status", showAutosaveStatus, (checked) => {
				showAutosaveStatus = checked;
				debugSettings.update("showAutosaveStatus", checked);
			})
			.addSwitch("verbose-logging", "Verbose Logging", verboseLogging, (checked) => {
				verboseLogging = checked;
				debugSettings.update("verboseLogging", checked);
			})
			.addSwitch("simulate-offline", "Simulate Offline", simulateOffline, (checked) => {
				simulateOffline = checked;
				debugSettings.update("simulateOffline", checked);
				// Toggle NetworkService simulation - it handles its own state
				NetworkService.toggleSimulateOffline();
			})
			.register({
				ButtonControl: ButtonControl as any,
				SwitchControl: SwitchControl as any,
				SelectControl: null as any,
			});

		return () => {
			window.removeEventListener("keydown", handleKeydown);
			window.removeEventListener("beforeunload", handleBeforeUnload);
			cleanup();
		};
	});

	onDestroy(() => {
		// Cancel any pending autosave
		cancelAutosave();
		
		// Cancel localStorage save timer
		cancelLocalStorageSave();
		
		window.removeEventListener("keydown", handleKeydown);
		window.removeEventListener("beforeunload", handleBeforeUnload);
	});
</script>

<div class="whiteboard-feature">
	<!-- Canvas Area -->
	<div class="canvas-area">
		<!-- Loading Overlay -->
		{#if !isCanvasFullyLoaded}
			<div class="loading-overlay">
				<div class="loading-spinner">
					<div class="spinner"></div>
					<div class="loading-text">Loading whiteboard...</div>
				</div>
			</div>
		{/if}
		
		<!-- Whiteboard Canvas -->
		<WhiteboardCanvas
			bind:this={canvasRef}
			initialData={canvasInitialData}
			bind:excalidrawAPI
			onChange={handleCanvasChange}
			onHomeClick={() => listModalOpen = true}
			onSaveClick={handleSaveClick}
			saveState={{
				hasUnsavedChanges,
				isSaving,
				isAutoSaving,
				hasWhiteboard: !!currentWhiteboard
			}}
			whiteboardTitle={currentWhiteboard?.title || null}
		/>
	</div>

	<!-- Save Dialog -->
	<WhiteboardSaveDialog
		open={saveDialogOpen}
		entry={currentWhiteboard}
		mode={currentWhiteboard ? "edit" : "create"}
		onClose={() => {
			if (!isSaving) {
				saveDialogOpen = false;
			}
		}}
		on:save={(e) => handleSave(e.detail)}
	/>

	<!-- Discard Confirmation -->
	<ConfirmDialog
		open={discardConfirmOpen}
		title="Discard unsaved changes?"
		description="You have unsaved changes. Are you sure you want to discard them and continue?"
		confirmText="Discard"
		cancelText="Cancel"
		variant="destructive"
		onconfirm={handleDiscardConfirm}
		oncancel={handleDiscardCancel}
	/>

	<!-- Whiteboard List Modal -->
	<WhiteboardListModal
		bind:open={listModalOpen}
		{entries}
		activeId={currentWhiteboard?.id || null}
		onSelect={handleSelectWhiteboard}
		onNew={handleNewWhiteboard}
		onDelete={handleDelete}
	/>
</div>

<style>
	.whiteboard-feature {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		position: relative;
		overflow: hidden;
	}

	.canvas-area {
		flex: 1 1 auto;
		position: relative;
		overflow: hidden;
		min-height: 0;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
	}

	.loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: hsl(var(--background));
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.loading-spinner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid hsl(var(--muted));
		border-top-color: hsl(var(--primary));
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.loading-text {
		color: hsl(var(--muted-foreground));
		font-size: 0.875rem;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.spin {
		animation: spin 1s linear infinite;
	}
</style>
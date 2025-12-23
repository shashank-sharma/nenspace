<script lang="ts">
	import AsyncExcalidraw from "$lib/components/excalidraw/AsyncExcalidraw.svelte";
	import type {
		ExcalidrawImperativeAPI,
		ExcalidrawInitialDataState,
	} from "@excalidraw/excalidraw/types/types.js";
	import type {
		ExcalidrawElement,
		AppState,
	} from "@excalidraw/excalidraw/types/types.js";
	import type { ExcalidrawContent } from "../types";
	import { ThemeService } from "$lib/services/theme.service.svelte";
	import { browser } from "$app/environment";
	import { onDestroy } from "svelte";

	// Constants
	const RETRY_MAX_ATTEMPTS = 10;
	const RETRY_DELAY_MS = 200;
	const TOOLBAR_INIT_DELAY_MS = 500;
	const TITLE_UPDATE_DELAY_MS = 300;
	const CONTENT_LOAD_DELAY_MS = 600;
	const INIT_CONTENT_DELAY_MS = 150;
	const CHANGE_DETECTION_THROTTLE_MS = 3000;

	// Color constants for toolbar border states
	const BORDER_COLORS = {
		saving: 'hsl(47.9 95.8% 53.1%)', // yellow-500
		unsaved: 'hsl(var(--destructive))',
		saved: 'hsl(142.1 71% 45%)', // green-600
		default: 'gray'
	} as const;

	let {
		initialData = null,
		excalidrawAPI = $bindable(),
		onChange,
		onSave,
		onHomeClick,
		onSaveClick,
		saveState,
		whiteboardTitle = null,
	} = $props<{
		initialData?: ExcalidrawInitialDataState | null;
		excalidrawAPI?: ExcalidrawImperativeAPI | undefined;
		onChange?: (
			content: ExcalidrawContent | null,
			hasChanges: boolean,
		) => void;
		onSave?: () => ExcalidrawContent | null;
		onHomeClick?: () => void;
		onSaveClick?: () => void;
		saveState?: {
			hasUnsavedChanges: boolean;
			isSaving: boolean;
			isAutoSaving: boolean;
			hasWhiteboard: boolean;
		};
		whiteboardTitle?: string | null;
	}>();

	let lastSavedContent = $state<ExcalidrawContent | null>(null);
	let currentContent = $state<ExcalidrawContent | null>(null);
	let internalAPI = $state<ExcalidrawImperativeAPI | undefined>(undefined);
	let isLoadingContent = $state(false);
	let isToolbarReady = $state(false);
	let isTitleSet = $state(false);
	let isFullyLoaded = $state(false);
	
	// Track timers for cleanup
	let toolbarInitTimer: ReturnType<typeof setTimeout> | null = null;
	let titleUpdateTimer: ReturnType<typeof setTimeout> | null = null;
	let loadingTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
	let toolbarButtons: HTMLButtonElement[] = [];
	
	/**
	 * Gets whether the canvas is fully loaded and ready
	 * @returns true if all components (toolbar, title, content) are ready
	 */
	export function getIsFullyLoaded(): boolean {
		return isFullyLoaded;
	}

	let cachedHasUnsavedChanges = $state(false);
	let changeDetectionTimer: ReturnType<typeof setTimeout> | null = null;
	let lastCheckedContentHash = $state<string>("");
	
	const MAX_LOADING_TIMEOUT_MS = 30000;
	function quickCompareContent(
		a: ExcalidrawContent | null,
		b: ExcalidrawContent | null,
	): boolean {
		if (!a && !b) return true;
		if (!a || !b) return false;

		const aCount = a.elements?.length || 0;
		const bCount = b.elements?.length || 0;
		if (aCount !== bCount) return false;

		if (aCount === 0) return true;

		// Create hash based on element IDs and versionNonce to avoid full JSON.stringify
		const aHash = a.elements
			.map((e) => `${e.id}-${e.versionNonce || 0}`)
			.join(",");
		const bHash = b.elements
			.map((e) => `${e.id}-${e.versionNonce || 0}`)
			.join(",");

		if (aHash !== bHash) return false;

		return JSON.stringify(a) === JSON.stringify(b);
	}

	function updateHasUnsavedChanges() {
		if (changeDetectionTimer) {
			return;
		}

		changeDetectionTimer = setTimeout(() => {
			changeDetectionTimer = null;

			if (!currentContent) {
				cachedHasUnsavedChanges = false;
				lastCheckedContentHash = "";
				return;
			}

			const elementCount = currentContent.elements?.length || 0;
			if (elementCount === 0) {
				cachedHasUnsavedChanges = false;
				lastCheckedContentHash = "";
				return;
			}

			if (!lastSavedContent) {
				cachedHasUnsavedChanges = true;
				lastCheckedContentHash = "";
				return;
			}

			if (elementCount !== (lastSavedContent.elements?.length || 0)) {
				cachedHasUnsavedChanges = true;
				lastCheckedContentHash = "";
				return;
			}

			let currentHash: string;
			if (elementCount < 50) {
				currentHash = currentContent.elements
					.map((e) => `${e.id}-${e.versionNonce || 0}`)
					.join(",");
			} else {
				const sampleSize = Math.min(50, elementCount);
				const step = Math.floor(elementCount / sampleSize);
				const sampled = [];
				for (let i = 0; i < elementCount; i += step) {
					const el = currentContent.elements[i];
					sampled.push(`${el.id}-${el.versionNonce || 0}`);
				}
				currentHash = `${elementCount}-${sampled.join(",")}`;
			}

			if (currentHash === lastCheckedContentHash) {
				return;
			}

			lastCheckedContentHash = currentHash;
			cachedHasUnsavedChanges = !quickCompareContent(
				currentContent,
				lastSavedContent,
			);
		}, CHANGE_DETECTION_THROTTLE_MS);
	}

	let hasUnsavedChanges = $derived(cachedHasUnsavedChanges);

	const theme = $derived(
		ThemeService.theme === "dark" || ThemeService.theme === "system"
			? document.documentElement.getAttribute("data-theme") === "dark"
				? "dark"
				: "light"
			: "light",
	);

	function handleChange(elements: ExcalidrawElement[], state: AppState) {
		if (!internalAPI && !excalidrawAPI) return;

		// Don't trigger change events while loading content (prevents autosave during load)
		if (isLoadingContent) {
			return;
		}

		// Sanitize appState before storing
		const sanitizedState = sanitizeAppState(state);

		currentContent = {
			elements,
			appState: sanitizedState,
		};

		updateHasUnsavedChanges();
		onChange?.(currentContent, cachedHasUnsavedChanges);
	}

	function sanitizeAppState(appState: AppState | null | undefined): AppState {
		if (!appState) return {};

		const sanitized = { ...appState };
		delete (sanitized as any).collaborators;
		delete (sanitized as any).socketId;
		delete (sanitized as any).socket;

		return sanitized;
	}

	/**
	 * Updates the toolbar border color based on save state
	 */
	function updateToolbarBorder() {
		if (!browser || !saveState) return;
		
		const toolbarContainer = document.querySelector('.Island.App-toolbar') as HTMLElement | null;
		if (!toolbarContainer) return;

		let borderColor: string;
		
		if (saveState.isSaving || saveState.isAutoSaving) {
			borderColor = BORDER_COLORS.saving;
		} else if (saveState.hasWhiteboard && saveState.hasUnsavedChanges) {
			borderColor = BORDER_COLORS.unsaved;
		} else if (saveState.hasWhiteboard && !saveState.hasUnsavedChanges) {
			borderColor = BORDER_COLORS.saved;
		} else {
			borderColor = BORDER_COLORS.default;
		}

		toolbarContainer.style.borderBottom = `1px solid ${borderColor}`;
	}

	/**
	 * Updates the HintViewer text with the whiteboard title
	 */
	function updateHintViewerTitle() {
		if (!browser) return;
		
		if (titleUpdateTimer) {
			clearTimeout(titleUpdateTimer);
			titleUpdateTimer = null;
		}
		
		const findHintViewer = (): HTMLElement | null => {
			const hintViewer = document.querySelector('.HintViewer');
			if (hintViewer) {
				const span = hintViewer.querySelector('span');
				if (span) {
					return span as HTMLElement;
				}
			}
			return null;
		};

		let attempts = 0;
		
		const tryUpdateTitle = () => {
			attempts++;
			const hintSpan = findHintViewer();
			
			if (hintSpan) {
				if (whiteboardTitle && whiteboardTitle.trim()) {
					hintSpan.textContent = whiteboardTitle;
				} else {
					hintSpan.textContent = '';
				}
				isTitleSet = true;
				checkFullyLoaded();
			} else if (attempts < RETRY_MAX_ATTEMPTS) {
				titleUpdateTimer = setTimeout(tryUpdateTitle, RETRY_DELAY_MS);
			} else {
				isTitleSet = true;
				checkFullyLoaded();
			}
		};

		titleUpdateTimer = setTimeout(tryUpdateTitle, TITLE_UPDATE_DELAY_MS);
	}

	/**
	 * Checks if all components are ready and updates the fully loaded state
	 */
	function checkFullyLoaded() {
		if (isToolbarReady && isTitleSet && !isLoadingContent && internalAPI) {
			isFullyLoaded = true;
			if (loadingTimeoutTimer) {
				clearTimeout(loadingTimeoutTimer);
				loadingTimeoutTimer = null;
			}
		}
	}

	/**
	 * Creates and adds custom toolbar icons (home and save) to Excalidraw toolbar
	 */
	function addCustomToolbarIcons() {
		if (!browser) return;
		
		if (toolbarInitTimer) {
			clearTimeout(toolbarInitTimer);
			toolbarInitTimer = null;
		}
		
		const findToolbarContainer = (): { container: HTMLElement; stack: HTMLElement | null } | null => {
			const toolbarContainer = document.querySelector('.Island.App-toolbar');
			if (!toolbarContainer) {
				return null;
			}
			
			const stack = toolbarContainer.querySelector('.Stack.Stack_horizontal') as HTMLElement | null;
			
			return {
				container: toolbarContainer as HTMLElement,
				stack: stack
			};
		};

		let attempts = 0;
		
		const tryAddIcons = () => {
			attempts++;
			const toolbarData = findToolbarContainer();
			
			if (toolbarData && toolbarData.stack) {
				const stack = toolbarData.stack;
				const container = toolbarData.container;
				
				if (stack.querySelector('[data-custom-home-icon]') || stack.querySelector('[data-custom-cloud-icon]')) {
					updateToolbarBorder();
					return;
				}

				container.style.borderBottom = '1px solid gray';

				const homeButton = createToolbarButton({
					icon: 'home',
					title: 'Browse all whiteboards',
					ariaLabel: 'Browse all whiteboards',
					dataAttribute: 'data-custom-home-icon',
					onClick: onHomeClick
				});

				const cloudButton = createToolbarButton({
					icon: 'cloud',
					title: 'Save to cloud',
					ariaLabel: 'Save whiteboard',
					dataAttribute: 'data-custom-cloud-icon',
					onClick: onSaveClick
				});

				toolbarButtons = [homeButton, cloudButton];

				stack.insertBefore(homeButton, stack.firstChild);
				stack.appendChild(cloudButton);

				updateToolbarBorder();
				isToolbarReady = true;
				checkFullyLoaded();
			} else if (attempts < RETRY_MAX_ATTEMPTS) {
				toolbarInitTimer = setTimeout(tryAddIcons, RETRY_DELAY_MS);
			} else {
				isToolbarReady = true;
				checkFullyLoaded();
			}
		};

		toolbarInitTimer = setTimeout(tryAddIcons, TOOLBAR_INIT_DELAY_MS);
	}

	/**
	 * Creates a toolbar button element with proper accessibility attributes
	 */
	function createToolbarButton(options: {
		icon: 'home' | 'cloud';
		title: string;
		ariaLabel: string;
		dataAttribute: string;
		onClick?: (() => void) | undefined;
	}): HTMLButtonElement {
		const button = document.createElement('button');
		button.setAttribute(options.dataAttribute, 'true');
		button.className = 'ToolIcon ToolIcon_size_medium';
		button.title = options.title;
		button.setAttribute('aria-label', options.ariaLabel);
		button.setAttribute('type', 'button');
		button.setAttribute('tabindex', '0');
		button.style.cssText = 'display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; background: transparent; color: currentColor; border-radius: 0.25rem;';
		
		const iconSvg = options.icon === 'home' 
			? '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>'
			: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>';
		
		button.innerHTML = `
			<div class="ToolIcon__icon" style="display: flex; align-items: center; justify-content: center;">
				<svg aria-hidden="true" focusable="false" role="img" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 1.25rem; height: 1.25rem;">
					${iconSvg}
				</svg>
			</div>
		`;
		
		const handleMouseEnter = () => {
			button.style.backgroundColor = 'var(--hover-bg, rgba(0, 0, 0, 0.05))';
		};
		const handleMouseLeave = () => {
			button.style.backgroundColor = 'transparent';
		};
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				options.onClick?.();
			}
		};
		
		button.addEventListener('mouseenter', handleMouseEnter);
		button.addEventListener('mouseleave', handleMouseLeave);
		button.addEventListener('keydown', handleKeyDown);
		
		if (options.onClick) {
			button.addEventListener('click', options.onClick);
		}
		
		return button;
	}
	
	/**
	 * Cleans up toolbar buttons and removes them from DOM
	 */
	function cleanupToolbarButtons() {
		toolbarButtons.forEach(button => {
			if (button && button.parentNode) {
				button.remove();
			}
		});
		toolbarButtons = [];
	}

	$effect(() => {
		if (saveState) {
			updateToolbarBorder();
		}
	});
	
	$effect(() => {
		checkFullyLoaded();
	});

	/**
	 * Handles Excalidraw API ready event
	 */
	function handleAPIReady(api: ExcalidrawImperativeAPI) {
		internalAPI = api;
		if (excalidrawAPI !== undefined) {
			excalidrawAPI = api;
		}

		isFullyLoaded = false;
		isToolbarReady = false;
		isTitleSet = false;

		cleanupToolbarButtons();

		if (loadingTimeoutTimer) {
			clearTimeout(loadingTimeoutTimer);
			loadingTimeoutTimer = null;
		}
		loadingTimeoutTimer = setTimeout(() => {
			if (!isFullyLoaded && loadingTimeoutTimer) {
				isToolbarReady = true;
				isTitleSet = true;
				isLoadingContent = false;
				isFullyLoaded = true;
				loadingTimeoutTimer = null;
			}
		}, MAX_LOADING_TIMEOUT_MS);

		addCustomToolbarIcons();
		updateHintViewerTitle();
		isLoadingContent = true;

		// Wait for Excalidraw to normalize content before capturing
		if (api && initialData) {
			setTimeout(() => {
				try {
					const elements = api.getSceneElements();
					const appState = api.getAppState();
					const sanitizedAppState = sanitizeAppState(appState);

					lastSavedContent = {
						elements: elements || [],
						appState: sanitizedAppState,
					};
					currentContent = lastSavedContent;
					markAsSaved();
				} catch (e) {
					console.error(
						"[WhiteboardCanvas] Failed to initialize saved content:",
						e,
					);
					lastSavedContent = null;
					currentContent = null;
				} finally {
					setTimeout(() => {
						isLoadingContent = false;
						checkFullyLoaded();
					}, 100);
				}
			}, INIT_CONTENT_DELAY_MS);
		} else {
			lastSavedContent = null;
			currentContent = null;

			setTimeout(() => {
				isLoadingContent = false;
				checkFullyLoaded();
			}, 200);
		}
	}

	$effect(() => {
		if (excalidrawAPI && !internalAPI) {
			internalAPI = excalidrawAPI;
		}
	});

	function markAsSaved() {
		if (currentContent) {
			lastSavedContent = JSON.parse(JSON.stringify(currentContent));
		} else {
			lastSavedContent = null;
		}
		cachedHasUnsavedChanges = false;
		lastCheckedContentHash = "";
		if (changeDetectionTimer) {
			clearTimeout(changeDetectionTimer);
			changeDetectionTimer = null;
		}
	}

	function resetContent() {
		lastSavedContent = null;
		currentContent = null;
	}

	/**
	 * Gets the current content from Excalidraw
	 * @returns The current Excalidraw content or null if API is not available
	 */
	export function getContent(): ExcalidrawContent | null {
		const api = internalAPI || excalidrawAPI;

		if (!api) {
			return null;
		}

		try {
			const elements = api.getSceneElements();
			const appState = api.getAppState();
			const sanitizedState = sanitizeAppState(appState);

			const content = {
				elements: Array.isArray(elements) ? elements : [],
				appState: sanitizedState,
			};

			return content;
		} catch (e) {
			console.error("[WhiteboardCanvas] Failed to get content:", e);
			return null;
		}
	}

	/**
	 * Marks the current content as saved
	 */
	export function markSaved() {
		markAsSaved();
	}

	/**
	 * Resets the canvas content
	 */
	export function reset() {
		resetContent();
	}

	/**
	 * Checks if there are unsaved changes
	 * @returns true if there are unsaved changes, false otherwise
	 */
	export function getHasUnsavedChanges(): boolean {
		return hasUnsavedChanges;
	}

	/**
	 * Checks if the canvas has any elements
	 * @returns true if the canvas has elements, false otherwise
	 */
	export function hasElements(): boolean {
		if (!currentContent) return false;
		return (
			Array.isArray(currentContent.elements) &&
			currentContent.elements.length > 0
		);
	}

	/**
	 * Loads content into the Excalidraw canvas
	 * @param content - The Excalidraw content to load, or null to clear the canvas
	 */
	export function loadContent(
		content: ExcalidrawInitialDataState | null,
	): void {
		const api = internalAPI || excalidrawAPI;
		if (!api) {
			return;
		}

		isLoadingContent = true;

		try {
			if (content && content.elements) {
				const sanitizedAppState = sanitizeAppState(content.appState);

				api.updateScene({
					elements: content.elements,
					appState: sanitizedAppState,
				});

				// Wait for Excalidraw to normalize content before capturing
				setTimeout(() => {
					try {
						const actualElements = api.getSceneElements();
						const actualAppState = api.getAppState();
						const actualSanitizedAppState =
							sanitizeAppState(actualAppState);

						lastSavedContent = {
							elements: actualElements || [],
							appState: actualSanitizedAppState,
						};
						currentContent = lastSavedContent;
						markAsSaved();
					} catch (e) {
						console.error(
							"[WhiteboardCanvas] Failed to capture loaded content:",
							e,
						);
					}
				}, 100);
			} else {
				api.updateScene({
					elements: [],
					appState: {},
				});

				setTimeout(() => {
					lastSavedContent = null;
					currentContent = null;
					markAsSaved();
				}, 100);
			}
		} catch (e) {
			console.error("[WhiteboardCanvas] Failed to load content:", e);
		} finally {
			setTimeout(() => {
				isLoadingContent = false;
				checkFullyLoaded();
			}, CONTENT_LOAD_DELAY_MS);
		}
	}

	$effect(() => {
		if (whiteboardTitle !== undefined) {
			updateHintViewerTitle();
		}
	});

	onDestroy(() => {
		if (changeDetectionTimer) {
			clearTimeout(changeDetectionTimer);
			changeDetectionTimer = null;
		}
		if (toolbarInitTimer) {
			clearTimeout(toolbarInitTimer);
			toolbarInitTimer = null;
		}
		if (titleUpdateTimer) {
			clearTimeout(titleUpdateTimer);
			titleUpdateTimer = null;
		}
		if (loadingTimeoutTimer) {
			clearTimeout(loadingTimeoutTimer);
			loadingTimeoutTimer = null;
		}
		
		cleanupToolbarButtons();
	});
</script>

<div class="whiteboard-canvas">
	<AsyncExcalidraw
		initialData={initialData || undefined}
		bind:excalidrawAPI
		{theme}
		onChangeHandler={handleChange}
		onReadyHandler={handleAPIReady}
	/>
</div>

<style>
	.whiteboard-canvas {
		width: 100%;
		height: 100%;
		min-height: 100%;
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		max-width: 100%;
		max-height: 100%;
		box-sizing: border-box;
		flex: 1 1 auto;
	}

	.whiteboard-canvas :global(.excalidraw-wrapper) {
		width: 100% !important;
		height: 100% !important;
		min-height: 100% !important;
		max-height: 100% !important;
		min-width: 100% !important;
		max-width: 100% !important;
		box-sizing: border-box;
		flex: 1 1 auto;
		position: relative;
		display: flex !important;
		flex-direction: column;
	}

	.whiteboard-canvas :global(.reactComponent) {
		width: 100% !important;
		height: 100% !important;
		min-height: 100% !important;
		max-height: 100% !important;
		min-width: 100% !important;
		max-width: 100% !important;
		box-sizing: border-box;
		flex: 1 1 auto;
		position: relative;
		display: flex !important;
		flex-direction: column;
	}

	/* Ensure Excalidraw's internal container takes full size */
	.whiteboard-canvas :global(.excalidraw-wrapper > *) {
		width: 100% !important;
		height: 100% !important;
		flex: 1 1 auto;
		min-height: 100% !important;
	}
</style>

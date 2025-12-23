import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types.js";
import type { AppState } from "@excalidraw/excalidraw/types/types.js";

export interface ExcalidrawContent {
	elements: ExcalidrawElement[];
	appState: AppState;
	files?: Record<string, any>;
}

export interface WhiteboardEntry {
	id: string;
	user: string;
	title: string;
	description: string;
	content: ExcalidrawContent | null;
	tags: string[];
	thumbnail: string;
	slug: string;
	created: string;
	updated: string;
}

export interface WhiteboardFilter {
	searchTerm?: string;
	tags?: string[];
}

export interface WhiteboardFormData {
	title: string;
	description: string;
	content: ExcalidrawContent | null;
	tags: string[];
	thumbnail?: File | null;
}

export interface WhiteboardState {
	entries: WhiteboardEntry[];
	isLoading: boolean;
	hasMore: boolean;
	page: number;
	totalItems: number;
	filter: WhiteboardFilter;
}

export const DEFAULT_WHITEBOARD_FORM: WhiteboardFormData = {
	title: "",
	description: "",
	content: null,
	tags: [],
};

export function formatDateGroup(dateString: string): string {
	if (!dateString || dateString === "unknown") return "Unknown Date";
	try {
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return "Invalid Date";
		const now = new Date();
		const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
		const yesterday = new Date();
		yesterday.setDate(now.getDate() - 1);
		if (isSameDay(date, now)) return "Today";
		if (isSameDay(date, yesterday)) return "Yesterday";
		return date.toLocaleDateString(undefined, {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	} catch {
		return "Unknown Date";
	}
}

export function formatTime(dateString: string): string {
	try {
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return "Invalid Time";
		return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
	} catch {
		return "Invalid Time";
	}
}

/**
 * Generate a URL-friendly slug from a title
 */
export function generateSlug(title: string): string {
	return title
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, "") // Remove special characters
		.replace(/[\s_-]+/g, "-") // Replace spaces, underscores, multiple dashes with single dash
		.replace(/^-+|-+$/g, ""); // Remove leading/trailing dashes
}

/**
 * Generate a unique slug by appending a number if needed
 */
export async function generateUniqueSlug(
	title: string,
	existingSlugs: string[],
	maxAttempts: number = 100
): Promise<string> {
	const baseSlug = generateSlug(title);
	
	if (!existingSlugs.includes(baseSlug)) {
		return baseSlug;
	}
	
	// Try appending numbers until we find a unique one
	for (let i = 2; i <= maxAttempts; i++) {
		const candidate = `${baseSlug}-${i}`;
		if (!existingSlugs.includes(candidate)) {
			return candidate;
		}
	}
	
	// Fallback: append timestamp if all attempts fail
	return `${baseSlug}-${Date.now()}`;
}


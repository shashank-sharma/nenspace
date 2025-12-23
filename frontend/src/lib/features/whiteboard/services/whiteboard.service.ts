import { pb } from "$lib/config/pocketbase";
import type { WhiteboardEntry, WhiteboardFilter, WhiteboardFormData } from "../types";
import { FilterBuilder } from "$lib/utils";
import { generateUniqueSlug } from "../types";
import type { RecordModel } from "pocketbase";
import { NetworkService } from "$lib/services/network.service.svelte";

/**
 * PocketBase record structure for whiteboard entries
 */
interface WhiteboardRecord extends RecordModel {
	user: string | RecordModel;
	title: string;
	description: string;
	content: string | object | null;
	tags: string[] | string;
	thumbnail: string;
	slug: string;
	created: string;
	updated: string;
}

/**
 * Whiteboard entry with PocketBase record reference for file URL generation
 */
interface WhiteboardEntryWithRecord extends WhiteboardEntry {
	_pbRecord?: WhiteboardRecord;
}

export class WhiteboardService {
	/**
	 * Validate and sanitize whiteboard form data
	 * @param data - Form data to validate
	 * @returns Sanitized form data
	 * @throws Error if validation fails
	 */
	private static validateAndSanitizeFormData(
		data: Partial<WhiteboardFormData>
	): Partial<WhiteboardFormData> {
		const sanitized: Partial<WhiteboardFormData> = {};

		// Validate and sanitize title
		if (data.title !== undefined) {
			const title = data.title.trim();
			if (title.length === 0) {
				throw new Error("Title cannot be empty");
			}
			if (title.length > 255) {
				throw new Error("Title must be 255 characters or less");
			}
			sanitized.title = title;
		}

		// Validate and sanitize description
		if (data.description !== undefined) {
			const description = data.description.trim();
			if (description.length > 5000) {
				throw new Error("Description must be 5000 characters or less");
			}
			sanitized.description = description;
		}

		// Validate tags
		if (data.tags !== undefined) {
			if (!Array.isArray(data.tags)) {
				throw new Error("Tags must be an array");
			}
			// Sanitize each tag: trim, remove empty, limit length
			const sanitizedTags = data.tags
				.map((tag) => tag.trim())
				.filter((tag) => tag.length > 0)
				.filter((tag) => tag.length <= 50)
				.slice(0, 20); // Limit to 20 tags
			sanitized.tags = sanitizedTags;
		}

		// Validate content structure if provided
		if (data.content !== undefined && data.content !== null) {
			if (typeof data.content !== "object") {
				throw new Error("Content must be an object");
			}
			// Content structure is validated by Excalidraw, just ensure it's an object
			sanitized.content = data.content;
		}

		// Thumbnail is validated by File type or null
		if (data.thumbnail !== undefined) {
			sanitized.thumbnail = data.thumbnail;
		}

		return sanitized;
	}

	/**
	 * Map PocketBase record to WhiteboardEntry
	 * Handles type conversion and parsing of JSON fields
	 */
	private static mapPocketBaseRecordToWhiteboardEntry(
		item: WhiteboardRecord
	): WhiteboardEntryWithRecord {
		// Extract user ID from expanded or string value
		const userId =
			typeof item.user === "string"
				? item.user
				: (item.user as RecordModel)?.id || item.user;

		// Parse content if it's a string
		let content: WhiteboardEntry["content"] = null;
		if (item.content) {
			if (typeof item.content === "string") {
				try {
					content = JSON.parse(item.content);
				} catch {
					content = null;
				}
			} else {
				content = item.content as WhiteboardEntry["content"];
			}
		}

		// Parse tags if it's a string
		let tags: string[] = [];
		if (item.tags) {
			if (Array.isArray(item.tags)) {
				tags = item.tags;
			} else if (typeof item.tags === "string") {
				try {
					tags = JSON.parse(item.tags);
				} catch {
					tags = [];
				}
			}
		}

		const entry: WhiteboardEntryWithRecord = {
			id: item.id,
			user: userId as string,
			title: item.title || "",
			description: item.description || "",
			content,
			tags,
			thumbnail: item.thumbnail || "",
			slug: item.slug || "",
			created: item.created,
			updated: item.updated,
			_pbRecord: item,
		};

		return entry;
	}
	/**
	 * Fetch whiteboard entries with pagination and filters
	 * 
	 * @param page - Page number (1-based)
	 * @param perPage - Number of items per page
	 * @param filter - Optional filter criteria (search term, tags)
	 * @returns Promise resolving to paginated entries with metadata
	 * @throws Error if user is not authenticated, offline, or fetch fails
	 * 
	 * @example
	 * ```typescript
	 * const result = await WhiteboardService.getEntries(1, 20, { searchTerm: "diagram" });
	 * console.log(result.items); // Array of whiteboard entries
	 * console.log(result.totalItems); // Total count
	 * ```
	 */
	static async getEntries(
		page: number,
		perPage: number,
		filter?: WhiteboardFilter,
	): Promise<{
		items: WhiteboardEntry[];
		totalItems: number;
		hasMore: boolean;
	}> {
		const userId = pb.authStore.model?.id;
		if (!userId) {
			const error = new Error("User not authenticated");
			console.error("[WhiteboardService.getEntries] Authentication error:", error);
			throw error;
		}

		// Check network status before attempting API call
		if (!NetworkService.isOnline) {
			console.warn("[WhiteboardService.getEntries] Offline mode - cannot fetch entries");
			throw new Error("You are offline. Please check your internet connection.");
		}

		try {
			const filterBuilder = FilterBuilder.create().equals("user", userId);

			if (filter?.searchTerm?.trim()) {
				filterBuilder.contains("title", filter.searchTerm);
			}

			if (filter?.tags && filter.tags.length > 0) {
				filterBuilder.in("tags", filter.tags);
			}

			const filterString = filterBuilder.build();
			console.log("[WhiteboardService.getEntries] Fetching entries", {
				page,
				perPage,
				filter: filterString,
			});

			const result = await pb.collection("whiteboards").getList(page, perPage, {
				sort: "-updated",
				filter: filterString || undefined,
				expand: "user",
			});

			console.log("[WhiteboardService.getEntries] Success", {
				count: result.items.length,
				total: result.totalItems,
			});

			const entries = result.items.map((item) =>
				this.mapPocketBaseRecordToWhiteboardEntry(item as WhiteboardRecord)
			);

			return {
				items: entries,
				totalItems: result.totalItems,
				hasMore: result.items.length === perPage,
			};
		} catch (error) {
			console.error("[WhiteboardService.getEntries] Failed to fetch entries:", {
				error,
				page,
				perPage,
				filter,
			});
			throw error;
		}
	}

	/**
	 * Get a single whiteboard entry by ID
	 * 
	 * @param id - Whiteboard entry ID
	 * @returns Promise resolving to whiteboard entry
	 * @throws Error if offline, entry not found, or fetch fails
	 * 
	 * @example
	 * ```typescript
	 * const entry = await WhiteboardService.getEntry("abc123");
	 * console.log(entry.title);
	 * ```
	 */
	static async getEntry(id: string): Promise<WhiteboardEntry> {
		// Check network status before attempting API call
		if (!NetworkService.isOnline) {
			console.warn("[WhiteboardService.getEntry] Offline mode - cannot fetch entry");
			throw new Error("You are offline. Please check your internet connection.");
		}

		try {
			console.log("[WhiteboardService.getEntry] Fetching entry", { id });

			const item = await pb.collection("whiteboards").getOne(id, {
				expand: "user",
			});

			const entry = this.mapPocketBaseRecordToWhiteboardEntry(item as WhiteboardRecord);
			console.log("[WhiteboardService.getEntry] Success", { id, title: entry.title });
			return entry;
		} catch (error) {
			console.error("[WhiteboardService.getEntry] Failed to fetch entry:", { id, error });
			throw new Error(`Failed to load whiteboard entry: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	/**
	 * Get a single whiteboard entry by slug
	 * 
	 * @param slug - URL-friendly slug identifier
	 * @returns Promise resolving to whiteboard entry or null if not found or offline
	 * @throws Error if user is not authenticated
	 * 
	 * @example
	 * ```typescript
	 * const entry = await WhiteboardService.getEntryBySlug("my-diagram");
	 * if (entry) console.log(entry.title);
	 * ```
	 */
	static async getEntryBySlug(slug: string): Promise<WhiteboardEntry | null> {
		const userId = pb.authStore.model?.id;
		if (!userId) {
			const error = new Error("User not authenticated");
			console.error("[WhiteboardService.getEntryBySlug] Authentication error:", error);
			throw error;
		}

		// Check network status before attempting API call
		if (!NetworkService.isOnline) {
			console.warn("[WhiteboardService.getEntryBySlug] Offline mode - cannot fetch entry");
			return null; // Return null when offline (slug lookup requires server)
		}

		try {
			const filterBuilder = FilterBuilder.create()
				.equals("slug", slug)
				.equals("user", userId);
			
			console.log("[WhiteboardService.getEntryBySlug] Fetching entry", { slug });

			const items = await pb.collection("whiteboards").getList(1, 1, {
				filter: filterBuilder.build(),
			});

			if (items.items.length === 0) {
				console.log("[WhiteboardService.getEntryBySlug] Entry not found", { slug });
				return null;
			}

			const item = items.items[0];
			const entry = this.mapPocketBaseRecordToWhiteboardEntry(item as WhiteboardRecord);
			console.log("[WhiteboardService.getEntryBySlug] Success", { slug, id: entry.id });
			return entry;
		} catch (error) {
			console.error("[WhiteboardService.getEntryBySlug] Failed to fetch entry:", {
				slug,
				error,
			});
			return null;
		}
	}

	/**
	 * Get all existing slugs for the current user
	 * Used for generating unique slugs when creating/updating entries
	 * 
	 * @param excludeId - Optional ID to exclude from results (useful when updating)
	 * @returns Promise resolving to array of existing slugs (empty array if offline)
	 * 
	 * @example
	 * ```typescript
	 * const slugs = await WhiteboardService.getExistingSlugs();
	 * const uniqueSlug = generateUniqueSlug("My Diagram", slugs);
	 * ```
	 */
	static async getExistingSlugs(excludeId?: string): Promise<string[]> {
		const userId = pb.authStore.model?.id;
		if (!userId) {
			console.warn("[WhiteboardService.getExistingSlugs] No user ID, returning empty array");
			return [];
		}

		// Check network status before attempting API call
		if (!NetworkService.isOnline) {
			console.warn("[WhiteboardService.getExistingSlugs] Offline mode - cannot fetch slugs");
			return []; // Return empty array when offline (slug lookup requires server)
		}

		try {
			const filterBuilder = FilterBuilder.create().equals("user", userId);
			if (excludeId) {
				filterBuilder.notEquals("id", excludeId);
			}
			
			console.log("[WhiteboardService.getExistingSlugs] Fetching slugs", { excludeId });

			const items = await pb.collection("whiteboards").getFullList({
				filter: filterBuilder.build(),
				fields: "slug",
			});

			const slugs = items
				.map((item) => (item.slug as string) || "")
				.filter((slug) => slug.length > 0);
			
			console.log("[WhiteboardService.getExistingSlugs] Success", { count: slugs.length });
			return slugs;
		} catch (error) {
			console.error("[WhiteboardService.getExistingSlugs] Failed to fetch slugs:", {
				excludeId,
				error,
			});
			return [];
		}
	}

	/**
	 * Create a new whiteboard entry
	 * 
	 * @param data - Whiteboard form data (title, description, content, tags, thumbnail)
	 * @returns Promise resolving to created whiteboard entry
	 * @throws Error if user is not authenticated, offline, validation fails, or creation fails
	 * 
	 * @example
	 * ```typescript
	 * const entry = await WhiteboardService.createEntry({
	 *   title: "My Diagram",
	 *   description: "A flowchart",
	 *   content: { elements: [], appState: {} },
	 *   tags: ["diagram", "flowchart"]
	 * });
	 * ```
	 */
	static async createEntry(data: WhiteboardFormData): Promise<WhiteboardEntry> {
		const userId = pb.authStore.model?.id;
		if (!userId) {
			const error = new Error("User not authenticated");
			console.error("[WhiteboardService.createEntry] Authentication error:", error);
			throw error;
		}

		// Check network status before attempting API call
		if (!NetworkService.isOnline) {
			console.warn("[WhiteboardService.createEntry] Offline mode - cannot create entry");
			throw new Error("You are offline. Please check your internet connection to save whiteboard.");
		}

		try {
			// Validate and sanitize input data
			const sanitized = this.validateAndSanitizeFormData(data);
			const title = sanitized.title || data.title.trim();
			const description = sanitized.description ?? data.description.trim();
			const tags = sanitized.tags ?? (data.tags || []);

			console.log("[WhiteboardService.createEntry] Creating entry", {
				title,
				hasContent: !!data.content,
				elementsCount: data.content?.elements?.length || 0,
				tagsCount: tags.length,
				hasThumbnail: data.thumbnail instanceof File,
			});

			// Generate unique slug
			const existingSlugs = await this.getExistingSlugs();
			const slug = await generateUniqueSlug(title, existingSlugs);

			// Handle file upload if thumbnail is a File
			let formData: Record<string, unknown> = {
				title,
				description,
				content: data.content ? JSON.stringify(data.content) : null,
				tags: JSON.stringify(tags),
				slug,
				user: userId,
			};

			// If thumbnail is a File, use FormData for upload
			if (data.thumbnail instanceof File) {
				const uploadFormData = new FormData();
				Object.keys(formData).forEach((key) => {
					uploadFormData.append(key, formData[key] as string);
				});
				uploadFormData.append("thumbnail", data.thumbnail, data.thumbnail.name);
				formData = uploadFormData;
			} else if (data.thumbnail === null) {
				// Explicitly set to null if provided
				formData.thumbnail = null;
			}

			const created = await pb.collection("whiteboards").create(formData);

			const entry = this.mapPocketBaseRecordToWhiteboardEntry(created as WhiteboardRecord);
			console.log("[WhiteboardService.createEntry] Success", {
				id: entry.id,
				slug: entry.slug,
				title: entry.title,
			});
			return entry;
		} catch (error) {
			console.error("[WhiteboardService.createEntry] Failed to create entry:", {
				error,
				title: data.title,
			});
			if (error instanceof Error && error.message.includes("Title")) {
				throw error; // Re-throw validation errors as-is
			}
			throw new Error(`Failed to save whiteboard entry: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	/**
	 * Update an existing whiteboard entry
	 * 
	 * @param id - Whiteboard entry ID to update
	 * @param data - Partial form data with fields to update
	 * @returns Promise resolving to updated whiteboard entry
	 * @throws Error if offline, validation fails, or update fails
	 * 
	 * @example
	 * ```typescript
	 * const updated = await WhiteboardService.updateEntry("abc123", {
	 *   title: "Updated Title",
	 *   description: "New description"
	 * });
	 * ```
	 */
	static async updateEntry(
		id: string,
		data: Partial<WhiteboardFormData>,
	): Promise<WhiteboardEntry> {
		// Check network status before attempting API call
		if (!NetworkService.isOnline) {
			console.warn("[WhiteboardService.updateEntry] Offline mode - cannot update entry");
			throw new Error("You are offline. Please check your internet connection to save changes.");
		}

		try {
			console.log("[WhiteboardService.updateEntry] Updating entry", {
				id,
				fields: Object.keys(data),
			});

			// Validate and sanitize input data
			const sanitized = this.validateAndSanitizeFormData(data);
			let updateData: Record<string, unknown> = {};

			if (sanitized.title !== undefined) {
				updateData.title = sanitized.title;
				// Generate new slug if title changed
				const existingSlugs = await this.getExistingSlugs(id);
				const slug = await generateUniqueSlug(sanitized.title, existingSlugs);
				updateData.slug = slug;
			}
			if (sanitized.description !== undefined) {
				updateData.description = sanitized.description;
			}
			if (sanitized.content !== undefined) {
				updateData.content = sanitized.content
					? JSON.stringify(sanitized.content)
					: null;
			}
			if (sanitized.tags !== undefined) {
				updateData.tags = JSON.stringify(sanitized.tags);
			}

			// Handle file upload if thumbnail is a File
			if (sanitized.thumbnail instanceof File) {
				const uploadFormData = new FormData();
				Object.keys(updateData).forEach((key) => {
					uploadFormData.append(key, updateData[key] as string);
				});
				uploadFormData.append(
					"thumbnail",
					sanitized.thumbnail,
					sanitized.thumbnail.name
				);
				updateData = uploadFormData;
			} else if (sanitized.thumbnail === null) {
				// Explicitly set to null if provided
				updateData.thumbnail = null;
			}

			const updated = await pb.collection("whiteboards").update(id, updateData);

			const entry = this.mapPocketBaseRecordToWhiteboardEntry(updated as WhiteboardRecord);
			console.log("[WhiteboardService.updateEntry] Success", {
				id: entry.id,
				title: entry.title,
			});
			return entry;
		} catch (error) {
			console.error("[WhiteboardService.updateEntry] Failed to update entry:", {
				id,
				error,
			});
			if (error instanceof Error && error.message.includes("Title")) {
				throw error; // Re-throw validation errors as-is
			}
			throw new Error(`Failed to update whiteboard entry: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	/**
	 * Delete a whiteboard entry
	 * 
	 * @param id - Whiteboard entry ID to delete
	 * @returns Promise that resolves when deletion is complete
	 * @throws Error if offline or deletion fails
	 * 
	 * @example
	 * ```typescript
	 * await WhiteboardService.deleteEntry("abc123");
	 * ```
	 */
	static async deleteEntry(id: string): Promise<void> {
		// Check network status before attempting API call
		if (!NetworkService.isOnline) {
			console.warn("[WhiteboardService.deleteEntry] Offline mode - cannot delete entry");
			throw new Error("You are offline. Please check your internet connection to delete whiteboard.");
		}

		try {
			console.log("[WhiteboardService.deleteEntry] Deleting entry", { id });
			await pb.collection("whiteboards").delete(id);
			console.log("[WhiteboardService.deleteEntry] Success", { id });
		} catch (error) {
			console.error("[WhiteboardService.deleteEntry] Failed to delete entry:", {
				id,
				error,
			});
			throw new Error(`Failed to delete whiteboard entry: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	}

	/**
	 * Get thumbnail URL for a whiteboard entry
	 * Generates an authenticated URL for the thumbnail image
	 * 
	 * @param entry - Whiteboard entry with thumbnail field
	 * @returns Thumbnail URL or empty string if no thumbnail
	 * 
	 * @example
	 * ```typescript
	 * const url = WhiteboardService.getThumbnailUrl(entry);
	 * if (url) console.log("Thumbnail:", url);
	 * ```
	 */
	static getThumbnailUrl(entry: WhiteboardEntry): string {
		if (!entry.thumbnail) return "";
		// Use original PocketBase record if available, otherwise use entry
		const entryWithRecord = entry as WhiteboardEntryWithRecord;
		const record = entryWithRecord._pbRecord || entry;
		return pb.files.getUrl(record, entry.thumbnail);
	}
}

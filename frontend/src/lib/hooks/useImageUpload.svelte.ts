/**
 * useImageUpload Hook
 * 
 * Composable for image upload, validation, drag-and-drop, and preview.
 * Eliminates ~120 lines of duplicate code per component.
 */

import { toast } from 'svelte-sonner';
import { onDestroy } from 'svelte';

export interface ImageUploadOptions {
    maxSizeMB: number;
    maxSizeBytes: number;
    allowedTypes: string[];
    onImageChange?: (file: File | undefined) => void;
}

export function useImageUpload(options: ImageUploadOptions) {
    let fileInputRef = $state<HTMLInputElement | null>(null);
    let dropZoneRef = $state<HTMLDivElement | null>(null);
    let isDragging = $state(false);
    let previewUrl = $state<string | null>(null);
    let currentFile = $state<File | undefined>(undefined);

    /**
     * Validate and handle file
     */
    function handleFile(file: File | null) {
        if (!file) return;

        // Validate file type
        if (!options.allowedTypes.includes(file.type)) {
            toast.error(
                `Please select a valid image file (${options.allowedTypes.map((t) => t.split('/')[1].toUpperCase()).join(', ')})`
            );
            return;
        }

        // Validate file size
        if (file.size > options.maxSizeBytes) {
            toast.error(`Image size must be less than ${options.maxSizeMB}MB`);
            return;
        }

        // Set file and create preview
        currentFile = file;
        
        // Generate preview URL
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        previewUrl = URL.createObjectURL(file);

        // Notify parent
        options.onImageChange?.(file);
    }

    /**
     * Handle file input change
     */
    function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;
        handleFile(input.files[0]);
    }

    /**
     * Handle drag over
     */
    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        isDragging = true;
    }

    /**
     * Handle drag leave
     */
    function handleDragLeave() {
        isDragging = false;
    }

    /**
     * Handle drop
     */
    function handleDrop(event: DragEvent) {
        event.preventDefault();
        isDragging = false;

        if (event.dataTransfer?.files?.length) {
            handleFile(event.dataTransfer.files[0]);
        }
    }

    /**
     * Remove image
     */
    function removeImage() {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        previewUrl = null;
        currentFile = undefined;
        if (fileInputRef) {
            fileInputRef.value = '';
        }
        options.onImageChange?.(undefined);
    }

    /**
     * Set preview from URL (for editing existing items with images)
     */
    function setPreviewFromUrl(url: string) {
        previewUrl = url;
    }

    /**
     * Reset (clear file and preview)
     */
    function reset() {
        removeImage();
    }

    /**
     * Trigger file input click
     */
    function openFilePicker() {
        fileInputRef?.click();
    }

    /**
     * Bind file input element
     */
    function bindFileInput(element: HTMLInputElement) {
        fileInputRef = element;
    }

    /**
     * Bind drop zone element and set up drag handlers
     */
    function bindDropZone(element: HTMLDivElement) {
        dropZoneRef = element;
        
        if (element) {
            element.addEventListener('dragover', handleDragOver);
            element.addEventListener('dragleave', handleDragLeave);
            element.addEventListener('drop', handleDrop);
        }

        return () => {
            if (dropZoneRef) {
                dropZoneRef.removeEventListener('dragover', handleDragOver);
                dropZoneRef.removeEventListener('dragleave', handleDragLeave);
                dropZoneRef.removeEventListener('drop', handleDrop);
            }
        };
    }

    // Cleanup on destroy
    onDestroy(() => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
    });

    return {
        // State
        get isDragging() { return isDragging; },
        get previewUrl() { return previewUrl; },
        get currentFile() { return currentFile; },
        
        // Methods
        handleFileSelect,
        removeImage,
        reset,
        openFilePicker,
        setPreviewFromUrl,
        bindFileInput,
        bindDropZone,
        
        // Refs (for manual binding if needed)
        get fileInputRef() { return fileInputRef; },
        get dropZoneRef() { return dropZoneRef; },
    };
}

/**
 * File Validation Utilities
 * Reusable file validation logic for uploads across the application
 */

export interface FileValidationOptions {
    allowedTypes: string[];
    maxSizeBytes: number;
    maxSizeMB: number;
}

export interface FileValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Validate a file against type and size constraints
 */
export function validateFile(
    file: File,
    options: FileValidationOptions
): FileValidationResult {
    if (!file) {
        return { isValid: false, error: 'No file provided' };
    }

    // Validate file type
    if (!options.allowedTypes.includes(file.type)) {
        const allowedExtensions = options.allowedTypes
            .map((t) => t.split('/')[1].toUpperCase())
            .join(', ');
        return {
            isValid: false,
            error: `Please select a valid file (${allowedExtensions})`,
        };
    }

    // Validate file size
    if (file.size > options.maxSizeBytes) {
        return {
            isValid: false,
            error: `File size must be less than ${options.maxSizeMB}MB`,
        };
    }

    return { isValid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if a file is an image
 */
export function isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
}

/**
 * Create a preview URL for an image file
 * Returns cleanup function to revoke the URL
 */
export function createImagePreview(file: File): {
    url: string;
    cleanup: () => void;
} {
    const url = URL.createObjectURL(file);
    return {
        url,
        cleanup: () => URL.revokeObjectURL(url),
    };
}


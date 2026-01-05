import { isImageFile } from '$lib/utils/file-validation.util';
import type { PreviewData } from '../types';

export function getPreviewType(mimeType: string): 'image' | 'pdf' | 'text' | 'unsupported' {
    if (mimeType.startsWith('image/')) {
        return 'image';
    }
    if (mimeType === 'application/pdf') {
        return 'pdf';
    }
    if (mimeType.startsWith('text/')) {
        return 'text';
    }
    return 'unsupported';
}

export function canPreview(mimeType: string): boolean {
    return getPreviewType(mimeType) !== 'unsupported';
}

export function isImageMimeType(mimeType: string): boolean {
    return mimeType.startsWith('image/');
}

export function isPdfMimeType(mimeType: string): boolean {
    return mimeType === 'application/pdf';
}

export function isTextMimeType(mimeType: string): boolean {
    return mimeType.startsWith('text/');
}


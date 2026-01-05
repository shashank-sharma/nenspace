import { normalizePath, joinPath, basename } from '$lib/features/markdown/utils/path';
import { MAX_FILENAME_LENGTH, MAX_PATH_LENGTH } from '../constants';

const RESERVED_FILENAMES = new Set([
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

const INVALID_CHARS_REGEX = /[<>:"|?*\x00-\x1f]/g;

export function sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
        throw new Error('Filename must be a non-empty string');
    }

    let sanitized = filename.trim();

    if (sanitized.length === 0) {
        throw new Error('Filename cannot be empty');
    }

    sanitized = sanitized.replace(INVALID_CHARS_REGEX, '');

    sanitized = sanitized.replace(/\.+$/, '');

    if (sanitized.length === 0) {
        throw new Error('Filename cannot consist only of invalid characters');
    }

    const nameWithoutExt = sanitized.split('.').slice(0, -1).join('.') || sanitized;
    const upperName = nameWithoutExt.toUpperCase();

    if (RESERVED_FILENAMES.has(upperName)) {
        sanitized = `_${sanitized}`;
    }

    if (sanitized.length > MAX_FILENAME_LENGTH) {
        const ext = sanitized.includes('.') ? sanitized.split('.').pop() : '';
        const namePart = sanitized.substring(0, MAX_FILENAME_LENGTH - ext.length - 1);
        sanitized = ext ? `${namePart}.${ext}` : namePart;
    }

    return sanitized;
}

export function sanitizePath(path: string): string {
    if (!path || typeof path !== 'string') {
        return '';
    }

    let sanitized = path.trim();

    if (sanitized.length === 0) {
        return '';
    }

    sanitized = sanitized.replace(/\.\./g, '');
    sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '');

    sanitized = normalizePath(sanitized);

    if (sanitized.startsWith('/')) {
        sanitized = sanitized.substring(1);
    }

    if (sanitized.length > MAX_PATH_LENGTH) {
        sanitized = sanitized.substring(0, MAX_PATH_LENGTH);
    }

    return sanitized;
}

export function buildFilePath(path: string, filename: string): string {
    const sanitizedPath = sanitizePath(path);
    const sanitizedFilename = sanitizeFilename(filename);

    if (sanitizedPath) {
        return joinPath(sanitizedPath, sanitizedFilename);
    }

    return sanitizedFilename;
}

export function validatePath(path: string): boolean {
    if (!path || typeof path !== 'string') {
        return false;
    }

    if (path.includes('..')) {
        return false;
    }

    if (path.length > MAX_PATH_LENGTH) {
        return false;
    }

    return true;
}


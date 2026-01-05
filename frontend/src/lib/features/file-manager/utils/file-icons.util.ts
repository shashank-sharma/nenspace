import { File, FileText, Image, Archive, FileCode, Music, Video, FileSpreadsheet } from 'lucide-svelte';
import type { Component } from 'svelte';

export function getFileIcon(mimeType: string): Component {
    if (mimeType.startsWith('image/')) {
        return Image;
    }

    if (mimeType.startsWith('video/')) {
        return Video;
    }

    if (mimeType.startsWith('audio/')) {
        return Music;
    }

    if (mimeType === 'application/pdf') {
        return FileText;
    }

    if (mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        mimeType === 'application/xml' ||
        mimeType === 'application/javascript' ||
        mimeType === 'application/typescript') {
        return FileCode;
    }

    if (mimeType.includes('spreadsheet') ||
        mimeType.includes('excel') ||
        mimeType.includes('csv')) {
        return FileSpreadsheet;
    }

    if (mimeType.includes('zip') ||
        mimeType.includes('tar') ||
        mimeType.includes('rar') ||
        mimeType.includes('7z') ||
        mimeType.includes('gzip')) {
        return Archive;
    }

    return File;
}

export function getFileIconColor(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
        return 'text-blue-500';
    }

    if (mimeType.startsWith('video/')) {
        return 'text-purple-500';
    }

    if (mimeType.startsWith('audio/')) {
        return 'text-green-500';
    }

    if (mimeType === 'application/pdf') {
        return 'text-red-500';
    }

    if (mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        mimeType === 'application/xml') {
        return 'text-yellow-500';
    }

    if (mimeType.includes('zip') || mimeType.includes('archive')) {
        return 'text-orange-500';
    }

    return 'text-muted-foreground';
}


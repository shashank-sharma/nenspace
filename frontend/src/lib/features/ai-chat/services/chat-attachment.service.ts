import { pb } from '$lib/config/pocketbase';
import type { FileUIPart } from '$lib/components/ai-elements/prompt-input/attachments-context.svelte';
import {
    MAX_FILE_SIZE,
    MAX_TOTAL_FILE_SIZE,
    MAX_FILES_PER_MESSAGE,
    SUPPORTED_FILE_TYPES
} from '../constants';

export interface ChatAttachmentMetadata {
    id: string;
    url: string;
    name: string;
    type: string;
    size: number;
}

function fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function dataURLToFile(dataUrl: string, filename: string, mimeType: string): File {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || mimeType;
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

async function urlToFile(url: string, filename: string, mimeType: string): Promise<File> {
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], filename, { type: mimeType || blob.type });
}

function validateFile(file: File): { valid: boolean; error?: string } {

    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File "${file.name}" exceeds maximum size of ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)}MB`
        };
    }

    const isSupported = SUPPORTED_FILE_TYPES.some(pattern => {
        if (pattern.endsWith('/*')) {
            const prefix = pattern.slice(0, -2);
            return file.type.startsWith(prefix);
        }
        return file.type === pattern || file.name.toLowerCase().endsWith(pattern.replace('*', ''));
    });

    if (!isSupported) {
        return {
            valid: false,
            error: `File type "${file.type}" is not supported. Supported types: ${SUPPORTED_FILE_TYPES.join(', ')}`
        };
    }

    return { valid: true };
}

export async function fileUIPartToFile(part: FileUIPart): Promise<File> {
    if (!part.url) {
        throw new Error('File URL is required');
    }

    const filename = part.filename || 'file';
    const mimeType = part.mediaType || 'application/octet-stream';

    if (part.url.startsWith('data:')) {
        return dataURLToFile(part.url, filename, mimeType);
    }

    return urlToFile(part.url, filename, mimeType);
}

export async function uploadAttachment(file: File | FileUIPart): Promise<ChatAttachmentMetadata> {
    let fileObj: File;
    if (file instanceof File) {
        fileObj = file;
    } else {
        fileObj = await fileUIPartToFile(file);
    }

    const validation = validateFile(fileObj);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const userId = pb.authStore.model?.id;
    if (!userId) {
        throw new Error('User not authenticated');
    }

    const formData = new FormData();
    formData.append('file', fileObj);
    formData.append('user', userId);
    formData.append('filename', fileObj.name);
    formData.append('mime_type', fileObj.type);
    formData.append('size', fileObj.size.toString());

    const attachmentRecord = await pb.collection('chat_message_attachments').create(formData);
    const fileUrl = pb.files.getUrl(attachmentRecord, attachmentRecord.file);

    return {
        id: attachmentRecord.id,
        url: fileUrl,
        name: fileObj.name,
        type: fileObj.type,
        size: fileObj.size
    };
}

export async function uploadAttachments(files: (File | FileUIPart)[]): Promise<ChatAttachmentMetadata[]> {
    if (files.length > MAX_FILES_PER_MESSAGE) {
        throw new Error(`Maximum ${MAX_FILES_PER_MESSAGE} files allowed per message`);
    }

    const fileObjects: File[] = [];
    for (const file of files) {
        if (file instanceof File) {
            fileObjects.push(file);
        } else {
            fileObjects.push(await fileUIPartToFile(file));
        }
    }

    const totalSize = fileObjects.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_FILE_SIZE) {
        throw new Error(`Total file size exceeds ${(MAX_TOTAL_FILE_SIZE / (1024 * 1024)).toFixed(1)}MB limit`);
    }

    const results = await Promise.all(
        fileObjects.map(file => uploadAttachment(file))
    );

    return results;
}

export async function getAttachmentsForMessage(messageId: string): Promise<ChatAttachmentMetadata[]> {
    const attachments = await pb.collection('chat_message_attachments').getFullList({
        filter: `message = "${messageId}"`
    });

    return attachments.map((att: any) => ({
        id: att.id,
        url: pb.files.getUrl(att, att.file),
        name: att.filename,
        type: att.mime_type,
        size: att.size
    }));
}

export async function getAttachmentsForMessages(messageIds: string[]): Promise<Map<string, ChatAttachmentMetadata[]>> {
    if (messageIds.length === 0) {
        return new Map();
    }

    const filterParts = messageIds.map(id => `message = "${id}"`);
    const filter = filterParts.join(' || ');

    const attachments = await pb.collection('chat_message_attachments').getFullList({
        filter
    });

    const attachmentsByMessage = new Map<string, ChatAttachmentMetadata[]>();

    attachments.forEach((att: any) => {
        const messageId = att.message;
        if (!attachmentsByMessage.has(messageId)) {
            attachmentsByMessage.set(messageId, []);
        }

        attachmentsByMessage.get(messageId)!.push({
            id: att.id,
            url: pb.files.getUrl(att, att.file),
            name: att.filename,
            type: att.mime_type,
            size: att.size
        });
    });

    return attachmentsByMessage;
}


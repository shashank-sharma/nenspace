import { pb } from '$lib/config/pocketbase';
import { FilterBuilder } from '$lib/utils';
import { normalizePath, joinPath } from '$lib/features/markdown/utils/path';
import { sanitizeFilename, sanitizePath, buildFilePath } from '../utils/file-sanitization.util';
import { QuotaService } from './quota.service';
import type { FileRecord, FileFilter, PreviewData } from '../types';
import { FILE_PAGE_SIZE } from '../constants';
import { downloadProgressStore } from '../stores/download-progress.store.svelte';
import { uploadProgressStore } from '../stores/upload-progress.store.svelte';

export class FileManagerService {
    static async uploadFile(
        file: File,
        path?: string,
        folderId?: string,
        description?: string,
        tags?: string[]
    ): Promise<FileRecord> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        if (!file) {
            throw new Error('File is required');
        }

        const sanitizedFilename = sanitizeFilename(file.name);
        let filePath = sanitizedFilename;

        if (folderId) {
            const { FolderService } = await import('./folder.service');
            const folderPath = await FolderService.getFolderPath(folderId);
            filePath = buildFilePath(folderPath, sanitizedFilename);
        } else if (path) {
            const sanitizedPath = sanitizePath(path);
            filePath = buildFilePath(sanitizedPath, sanitizedFilename);
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('user', userId);
        formData.append('filename', sanitizedFilename);
        formData.append('original_filename', file.name);
        formData.append('mime_type', file.type);
        formData.append('size', file.size.toString());
        formData.append('path', filePath);

        if (folderId) {
            formData.append('folder', folderId);
        }

        if (description?.trim()) {
            formData.append('description', description.trim());
        }

        if (tags && tags.length > 0) {
            formData.append('tags', JSON.stringify(tags));
        }

        const created = await pb.collection('files').create(formData);

        return created as FileRecord;
    }

    static async uploadFilesBulk(
        files: File[],
        folderId?: string,
        description?: string,
        tags?: string[]
    ): Promise<FileRecord[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        if (!files || files.length === 0) {
            throw new Error('At least one file is required');
        }

        const { FolderService } = await import('./folder.service');
        const folderPath = folderId ? await FolderService.getFolderPath(folderId) : '';

        const uploadPromises = files.map(async (file) => {
            const taskId = Math.random().toString(36).substring(2, 11);
            const sanitizedFilename = sanitizeFilename(file.name);
            const filePath = folderId ? buildFilePath(folderPath, sanitizedFilename) : sanitizedFilename;

            uploadProgressStore.addTask({
                id: taskId,
                filename: file.name,
                progress: 0,
                status: 'preparing',
                bytesUploaded: 0,
                totalBytes: file.size
            });

            const formData = new FormData();
            formData.append('file', file);
            formData.append('user', userId);
            formData.append('filename', sanitizedFilename);
            formData.append('original_filename', file.name);
            formData.append('mime_type', file.type);
            formData.append('size', file.size.toString());
            formData.append('path', filePath);

            if (folderId) {
                formData.append('folder', folderId);
            }

            if (description?.trim()) {
                formData.append('description', description.trim());
            }

            if (tags && tags.length > 0) {
                formData.append('tags', JSON.stringify(tags));
            }

            return new Promise<FileRecord>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const progress = Math.round((event.loaded / event.total) * 100);
                        uploadProgressStore.updateTask(taskId, {
                            status: 'uploading',
                            bytesUploaded: event.loaded,
                            progress
                        });
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            uploadProgressStore.updateTask(taskId, {
                                status: 'completed',
                                progress: 100,
                                bytesUploaded: file.size
                            });

                            resolve(response as FileRecord);
                        } catch (e) {
                            reject(new Error('Failed to parse server response'));
                        }
                    } else {
                        const errorMsg = `Upload failed with status ${xhr.status}`;
                        uploadProgressStore.updateTask(taskId, {
                            status: 'error',
                            errorMessage: errorMsg
                        });
                        reject(new Error(errorMsg));
                    }
                });

                xhr.addEventListener('error', () => {
                    const errorMsg = 'Network error occurred during upload';
                    uploadProgressStore.updateTask(taskId, {
                        status: 'error',
                        errorMessage: errorMsg
                    });
                    reject(new Error(errorMsg));
                });

                xhr.open('POST', `${pb.baseUrl}/api/collections/files/records`);
                xhr.setRequestHeader('Authorization', pb.authStore.token);
                xhr.send(formData);
            });
        });

        return Promise.all(uploadPromises);
    }

    static async getFiles(filter?: FileFilter): Promise<FileRecord[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const filterBuilder = FilterBuilder.create()
            .equals('user', userId);

        if (filter?.folder) {
            filterBuilder.equals('folder', filter.folder);
        } else if (filter?.folder === null || filter?.folder === undefined) {
            filterBuilder.isNull('folder');
        }

        if (filter?.searchQuery?.trim()) {
            const searchTerm = filter.searchQuery.trim();
            const filenameFilter = `filename ~ "${filterBuilder['escape'](searchTerm)}"`;
            const descFilter = `description ~ "${filterBuilder['escape'](searchTerm)}"`;
            filterBuilder.or(filenameFilter, descFilter);
        }

        if (filter?.mimeType?.trim()) {
            filterBuilder.equals('mime_type', filter.mimeType);
        }

        if (filter?.path?.trim()) {
            const sanitizedPath = sanitizePath(filter.path);
            filterBuilder.contains('path', sanitizedPath);
        }

        if (filter?.tags && filter.tags.length > 0) {
            const tagsFilter = filter.tags.map(tag => `tags ~ "${filterBuilder['escape'](tag)}"`).join(' || ');
            filterBuilder.raw(`(${tagsFilter})`);
        }

        const result = await pb.collection('files').getList(1, FILE_PAGE_SIZE, {
            sort: '-created',
            filter: filterBuilder.build()
        });

        return result.items as FileRecord[];
    }

    static async downloadFile(id: string): Promise<Blob> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const fileRecord = await this.getFileById(id);
        if (fileRecord.user !== userId) {
            throw new Error('Unauthorized access to file');
        }

        const fileUrl = pb.files.getUrl(fileRecord, fileRecord.file);
        const response = await fetch(fileUrl);

        if (!response.ok) {
            throw new Error('Failed to download file');
        }

        return await response.blob();
    }

    static async previewFile(id: string): Promise<PreviewData> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const fileRecord = await this.getFileById(id);
        if (fileRecord.user !== userId) {
            throw new Error('Unauthorized access to file');
        }

        const fileUrl = pb.files.getUrl(fileRecord, fileRecord.file);
        const mimeType = fileRecord.mime_type;

        let type: 'image' | 'pdf' | 'text' | 'unsupported';
        if (mimeType.startsWith('image/')) {
            type = 'image';
        } else if (mimeType === 'application/pdf') {
            type = 'pdf';
        } else if (mimeType.startsWith('text/')) {
            type = 'text';
        } else {
            type = 'unsupported';
        }

        return {
            type,
            url: fileUrl,
            filename: fileRecord.filename,
            mimeType
        };
    }

    static async deleteFile(id: string): Promise<void> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const fileRecord = await this.getFileById(id);
        if (fileRecord.user !== userId) {
            throw new Error('Unauthorized access to file');
        }

        await pb.collection('files').delete(id);
    }

    static async renameFile(id: string, newName: string): Promise<FileRecord> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const fileRecord = await this.getFileById(id);
        if (fileRecord.user !== userId) {
            throw new Error('Unauthorized access to file');
        }

        const sanitizedFilename = sanitizeFilename(newName);
        const currentPath = fileRecord.path;
        const dir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
        const newPath = dir ? joinPath(dir, sanitizedFilename) : sanitizedFilename;

        const updated = await pb.collection('files').update(id, {
            filename: sanitizedFilename,
            path: newPath
        });

        return updated as FileRecord;
    }

    static async moveFile(id: string, folderId: string | undefined): Promise<FileRecord> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const fileRecord = await this.getFileById(id);
        if (fileRecord.user !== userId) {
            throw new Error('Unauthorized access to file');
        }

        const updateData: Record<string, unknown> = {
            folder: folderId || null
        };

        if (folderId) {
            const { FolderService } = await import('./folder.service');
            const folderPath = await FolderService.getFolderPath(folderId);
            updateData.path = buildFilePath(folderPath, fileRecord.filename);
        } else {
            updateData.path = fileRecord.filename;
        }

        const updated = await pb.collection('files').update(id, updateData);

        return updated as FileRecord;
    }

    static async updateFileMetadata(
        id: string,
        data: Partial<Pick<FileRecord, 'description' | 'tags' | 'folder'>>
    ): Promise<FileRecord> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const fileRecord = await this.getFileById(id);
        if (fileRecord.user !== userId) {
            throw new Error('Unauthorized access to file');
        }

        const updateData: Record<string, unknown> = {};

        if (data.description !== undefined) {
            updateData.description = data.description?.trim() || null;
        }

        if (data.tags !== undefined) {
            updateData.tags = data.tags && data.tags.length > 0 ? JSON.stringify(data.tags) : null;
        }

        const updated = await pb.collection('files').update(id, updateData);

        return updated as FileRecord;
    }

    static async downloadSelectionAsZip(fileIds: string[], folderIds: string[]) {
        const token = pb.authStore.token;
        if (!token) {
            throw new Error('User not authenticated');
        }

        const taskId = Math.random().toString(36).substring(2, 11);
        let suggestedFilename = 'archive.zip';

        if (folderIds.length === 1 && fileIds.length === 0) {
            try {
                const folder = await pb.collection('folders').getOne(folderIds[0]);
                if (folder) {
                    suggestedFilename = `${folder.name}.zip`;
                }
            } catch (e) {
                console.error('Failed to get folder name for download:', e);
            }
        } else if (fileIds.length === 1 && folderIds.length === 0) {
            try {
                const file = await pb.collection('files').getOne(fileIds[0]);
                if (file) {
                    const name = file.original_filename || file.filename;
                    suggestedFilename = name.includes('.') ? `${name.substring(0, name.lastIndexOf('.'))}.zip` : `${name}.zip`;
                }
            } catch (e) {
                console.error('Failed to get file name for download:', e);
            }
        } else if (folderIds.length > 0 || fileIds.length > 1) {
            suggestedFilename = `selection-${new Date().getTime()}.zip`;
        }

        downloadProgressStore.addTask({
            id: taskId,
            filename: suggestedFilename,
            progress: 0,
            status: 'preparing',
            bytesDownloaded: 0
        });

        try {
            const params = new URLSearchParams();
            params.append('token', token);
            if (fileIds.length > 0) {
                params.append('fileIds', fileIds.join(','));
            }
            if (folderIds.length > 0) {
                params.append('folderIds', folderIds.join(','));
            }

            const url = `${pb.baseUrl}/api/custom/files/download-zip?${params.toString()}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            const contentLength = response.headers.get('Content-Length');
            const total = contentLength ? parseInt(contentLength, 10) : 0;

            downloadProgressStore.updateTask(taskId, {
                status: 'downloading',
                totalBytes: total || undefined
            });

            let receivedLength = 0;
            const chunks: Uint8Array[] = [];

            if (!reader) {
                throw new Error('Failed to start download stream');
            }

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                chunks.push(value);
                receivedLength += value.length;

                const progress = total ? Math.round((receivedLength / total) * 100) : 0;
                downloadProgressStore.updateTask(taskId, {
                    bytesDownloaded: receivedLength,
                    progress
                });
            }

            if (chunks.length === 0) {
                throw new Error('No data received from server');
            }

            const blob = new Blob(chunks, { type: 'application/zip' });
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = suggestedFilename;
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
            }, 100);

            downloadProgressStore.updateTask(taskId, { status: 'completed', progress: 100 });

        } catch (error) {
            console.error('ZIP download failed:', error);
            downloadProgressStore.updateTask(taskId, {
                status: 'error',
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private static async getFileById(id: string): Promise<FileRecord> {
        const fileRecord = await pb.collection('files').getOne(id);
        return fileRecord as FileRecord;
    }
}

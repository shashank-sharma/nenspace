import { pb } from '$lib/config/pocketbase';
import { FilterBuilder } from '$lib/utils';
import { sanitizeFilename, sanitizePath, buildFilePath } from '../utils/file-sanitization.util';
import type { FolderRecord } from '../types';
import { joinPath } from '$lib/features/markdown/utils/path';

export class FolderService {
    static async createFolder(name: string, parentId?: string): Promise<FolderRecord> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        if (!name?.trim()) {
            throw new Error('Folder name is required');
        }

        const sanitizedName = sanitizeFilename(name.trim());

        if (parentId) {
            const parent = await this.getFolderById(parentId);
            if (parent.user !== userId) {
                throw new Error('Unauthorized access to parent folder');
            }
        }

        const created = await pb.collection('folders').create({
            user: userId,
            name: sanitizedName,
            parent: parentId || null
        });

        return created as FolderRecord;
    }

    static async getFolders(parentId?: string): Promise<FolderRecord[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const filterBuilder = FilterBuilder.create()
            .equals('user', userId);

        if (parentId) {
            filterBuilder.equals('parent', parentId);
        } else {
            filterBuilder.isNull('parent');
        }

        const result = await pb.collection('folders').getList(1, 1000, {
            sort: 'name',
            filter: filterBuilder.build()
        });

        return result.items as FolderRecord[];
    }

    static async getFolderById(id: string): Promise<FolderRecord> {
        const folder = await pb.collection('folders').getOne(id);
        return folder as FolderRecord;
    }

    static async renameFolder(id: string, newName: string): Promise<FolderRecord> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const folder = await this.getFolderById(id);
        if (folder.user !== userId) {
            throw new Error('Unauthorized access to folder');
        }

        const sanitizedName = sanitizeFilename(newName.trim());

        const updated = await pb.collection('folders').update(id, {
            name: sanitizedName
        });

        return updated as FolderRecord;
    }

    static async deleteFolder(id: string): Promise<void> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const folder = await this.getFolderById(id);
        if (folder.user !== userId) {
            throw new Error('Unauthorized access to folder');
        }

        const childFolders = await this.getFolders(id);
        if (childFolders.length > 0) {
            throw new Error('Cannot delete folder: it contains subfolders');
        }

        const filesInFolder = await pb.collection('files').getList(1, 1, {
            filter: FilterBuilder.create()
                .equals('user', userId)
                .equals('folder', id)
                .build()
        });

        if (filesInFolder.items.length > 0) {
            throw new Error('Cannot delete folder: it contains files');
        }

        await pb.collection('folders').delete(id);
    }

    static async getFolderPath(folderId: string): Promise<string> {
        return this.buildPathFromParents(folderId);
    }

    static async buildPathFromParents(folderId: string): Promise<string> {
        const parts: string[] = [];
        let currentId: string | undefined = folderId;

        while (currentId) {
            const folder = await this.getFolderById(currentId);
            parts.unshift(folder.name);
            currentId = folder.parent;
        }

        return parts.join('/');
    }

    static async getBreadcrumbs(folderId?: string): Promise<FolderRecord[]> {
        if (!folderId) {
            return [];
        }

        const breadcrumbs: FolderRecord[] = [];
        let currentId: string | undefined = folderId;

        while (currentId) {
            const folder = await this.getFolderById(currentId);
            breadcrumbs.unshift(folder);
            currentId = folder.parent;
        }

        return breadcrumbs;
    }

    static async getAllFolders(): Promise<FolderRecord[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const filter = FilterBuilder.create()
            .equals('user', userId)
            .build();

        const result = await pb.collection('folders').getFullList({
            sort: 'name',
            filter
        });

        return result as FolderRecord[];
    }

    static async moveFolder(id: string, parentId: string | undefined): Promise<FolderRecord> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const folder = await this.getFolderById(id);
        if (folder.user !== userId) {
            throw new Error('Unauthorized access to folder');
        }

        if (parentId === id) {
            throw new Error('Cannot move folder into itself');
        }

        if (parentId) {
            const parent = await this.getFolderById(parentId);
            if (parent.user !== userId) {
                throw new Error('Unauthorized access to parent folder');
            }

            let checkParent: string | undefined = parent.parent;
            while (checkParent) {
                if (checkParent === id) {
                    throw new Error('Cannot move folder into its own subfolder');
                }
                const checkFolder = await this.getFolderById(checkParent);
                checkParent = checkFolder.parent;
            }
        }

        const updated = await pb.collection('folders').update(id, {
            parent: parentId || null
        });

        return updated as FolderRecord;
    }
}


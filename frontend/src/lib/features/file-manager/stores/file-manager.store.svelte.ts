import { pb } from '$lib/config/pocketbase';
import type { FileRecord, FolderRecord, QuotaInfo } from '../types';
import type { UnsubscribeFunc } from 'pocketbase';
import { FileManagerService, FolderService, QuotaService } from '../services';

class FileManagerStore {
    files = $state<FileRecord[]>([]);
    folders = $state<FolderRecord[]>([]);
    allFolders = $state<FolderRecord[]>([]);
    quotaInfo = $state<QuotaInfo | null>(null);
    selectedFolderId = $state<string | undefined>(undefined);
    selectedFiles = $state<Set<string>>(new Set());
    selectedFolders = $state<Set<string>>(new Set());
    loading = $state(false);
    error = $state<string | null>(null);

    private filesSubscription: UnsubscribeFunc | null = null;
    private foldersSubscription: UnsubscribeFunc | null = null;
    private currentUserId: string | null = null;
    private isSubscribing = $state(false);
    private loadPromise: Promise<void> | null = null;

    async initialize(userId: string) {
        if (!userId) return;
        if (this.currentUserId === userId && this.files.length > 0 && this.isSubscribing === false) return;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = this._doInitialize(userId);
        try {
            await this.loadPromise;
        } finally {
            this.loadPromise = null;
        }
    }

    private async _doInitialize(userId: string) {
        this.currentUserId = userId;
        this.loading = true;
        this.error = null;

        try {
            await Promise.all([
                this.loadFiles(),
                this.loadFolders(),
                this.loadQuotaInfo(),
                this.setupRealtimeSubscriptions(userId)
            ]);
        } catch (err) {
            this.error = err instanceof Error ? err.message : 'Failed to initialize file manager';
        } finally {
            this.loading = false;
        }
    }

    private async loadFiles() {
        try {
            const files = await FileManagerService.getFiles({ folder: this.selectedFolderId });
            this.files = files;
        } catch (err) {
            this.files = [];
        }
    }

    private async loadFolders() {
        try {
            const folders = await FolderService.getFolders(this.selectedFolderId);
            this.folders = folders;

            const allFolders = await FolderService.getAllFolders();
            this.allFolders = allFolders;
        } catch (err) {
            this.folders = [];
            this.allFolders = [];
        }
    }

    private async loadQuotaInfo() {
        if (!this.currentUserId) return;
        try {
            const quota = await QuotaService.getQuotaInfo(this.currentUserId);
            this.quotaInfo = quota;
        } catch (err) {}
    }

    private async setupRealtimeSubscriptions(userId: string) {
        if (this.isSubscribing || this.currentUserId !== userId) return;

        this.cleanupSubscriptions();
        this.isSubscribing = true;

        if (typeof window === 'undefined') {
            this.isSubscribing = false;
            return;
        }

        try {
            const filesUnsub = await pb
                .collection('files')
                .subscribe('*', (e: { action: string; record: FileRecord }) => {
                    if (e.record.user !== userId) return;

                    if (e.action === 'create') {
                        this.handleFileCreated(e.record);
                    } else if (e.action === 'update') {
                        this.handleFileUpdated(e.record);
                    } else if (e.action === 'delete') {
                        this.handleFileDeleted(e.record.id);
                    }
                });

            const foldersUnsub = await pb
                .collection('folders')
                .subscribe('*', (e: { action: string; record: FolderRecord }) => {
                    if (e.record.user !== userId) return;

                    if (e.action === 'create') {
                        this.handleFolderCreated(e.record);
                    } else if (e.action === 'update') {
                        this.handleFolderUpdated(e.record);
                    } else if (e.action === 'delete') {
                        this.handleFolderDeleted(e.record.id);
                    }
                });

            this.filesSubscription = filesUnsub;
            this.foldersSubscription = foldersUnsub;
        } catch (err) {
        } finally {
            this.isSubscribing = false;
        }
    }

    private handleFileCreated(record: FileRecord) {
        if (!this.files.find(f => f.id === record.id)) {
            if (record.folder === this.selectedFolderId || (!record.folder && !this.selectedFolderId)) {
                this.files = [...this.files, record];
            }

            if (this.quotaInfo && record.size) {
                this.quotaInfo = {
                    ...this.quotaInfo,
                    usedBytes: this.quotaInfo.usedBytes + record.size,
                    availableBytes: Math.max(0, this.quotaInfo.quotaBytes - (this.quotaInfo.usedBytes + record.size)),
                    percentUsed: ((this.quotaInfo.usedBytes + record.size) / this.quotaInfo.quotaBytes) * 100
                };
            }
        }
    }

    private handleFileUpdated(record: FileRecord) {
        const index = this.files.findIndex(f => f.id === record.id);
        if (index >= 0) {
            const oldFile = this.files[index];
            this.files[index] = record;
            this.files = [...this.files];

            if (record.folder !== oldFile.folder) {
                if (record.folder === this.selectedFolderId || (!record.folder && !this.selectedFolderId)) {
                    if (!this.files.find(f => f.id === record.id)) {
                        this.files = [...this.files, record];
                    }
                } else {
                    this.files = this.files.filter(f => f.id !== record.id);
                }
            }
        } else {
            if (record.folder === this.selectedFolderId || (!record.folder && !this.selectedFolderId)) {
                this.files = [...this.files, record];
            }
        }
    }

    private handleFileDeleted(fileId: string) {
        const file = this.files.find(f => f.id === fileId);
        this.files = this.files.filter(f => f.id !== fileId);

        if (file && this.quotaInfo && file.size) {
            this.quotaInfo = {
                ...this.quotaInfo,
                usedBytes: Math.max(0, this.quotaInfo.usedBytes - file.size),
                availableBytes: this.quotaInfo.quotaBytes - Math.max(0, this.quotaInfo.usedBytes - file.size),
                percentUsed: (Math.max(0, this.quotaInfo.usedBytes - file.size) / this.quotaInfo.quotaBytes) * 100
            };
        }

        this.selectedFiles.delete(fileId);
    }

    private handleFolderCreated(record: FolderRecord) {
        if (!this.allFolders.find(f => f.id === record.id)) {
            this.allFolders = [...this.allFolders, record];
        }

        if (record.parent === this.selectedFolderId || (!record.parent && !this.selectedFolderId)) {
            if (!this.folders.find(f => f.id === record.id)) {
                this.folders = [...this.folders, record];
            }
        }
    }

    private handleFolderUpdated(record: FolderRecord) {
        const index = this.allFolders.findIndex(f => f.id === record.id);
        if (index >= 0) {
            this.allFolders[index] = record;
            this.allFolders = [...this.allFolders];
        }

        const folderIndex = this.folders.findIndex(f => f.id === record.id);
        if (folderIndex >= 0) {
            this.folders[folderIndex] = record;
            this.folders = [...this.folders];
        }

        if (record.id === this.selectedFolderId) {
            this.selectedFolderId = record.id;
        }
    }

    private handleFolderDeleted(folderId: string) {
        this.allFolders = this.allFolders.filter(f => f.id !== folderId);
        this.folders = this.folders.filter(f => f.id !== folderId);

        if (this.selectedFolderId === folderId) {
            this.selectedFolderId = undefined;
        }

        this.files = this.files.filter(f => f.folder !== folderId);
        this.selectedFolders.delete(folderId);
        this.selectedFolders = new Set(this.selectedFolders);
    }

    async navigateToFolder(folderId: string | undefined) {
        this.loading = true;
        try {
            this.selectedFolderId = folderId;
            this.selectedFiles.clear();
            await Promise.all([
                this.loadFiles(),
                this.loadFolders()
            ]);
        } finally {
            this.loading = false;
        }
    }

    toggleFileSelection(fileId: string) {
        if (this.selectedFiles.has(fileId)) {
            this.selectedFiles.delete(fileId);
        } else {
            this.selectedFiles.add(fileId);
        }
        this.selectedFiles = new Set(this.selectedFiles);
    }

    toggleFolderSelection(folderId: string) {
        if (this.selectedFolders.has(folderId)) {
            this.selectedFolders.delete(folderId);
        } else {
            this.selectedFolders.add(folderId);
        }
        this.selectedFolders = new Set(this.selectedFolders);
    }

    selectAllFiles() {
        const allFileIds = new Set(this.files.map(f => f.id));
        this.selectedFiles = allFileIds;
    }

    clearSelection() {
        this.selectedFiles = new Set();
        this.selectedFolders = new Set();
    }

    getSelectedFiles(): FileRecord[] {
        return this.files.filter(f => this.selectedFiles.has(f.id));
    }

    get breadcrumbs(): FolderRecord[] {
        if (!this.selectedFolderId) return [];

        const breadcrumbs: FolderRecord[] = [];
        let currentId: string | undefined = this.selectedFolderId;

        while (currentId) {
            const folder = this.allFolders.find(f => f.id === currentId);
            if (folder) {
                breadcrumbs.unshift(folder);
                currentId = folder.parent;
            } else {
                currentId = undefined;
            }
        }

        return breadcrumbs;
    }

    getFolderFullPath(folderId: string): string {
        const pathParts: string[] = [];
        let currentFolder = this.allFolders.find(f => f.id === folderId);

        while (currentFolder) {
            pathParts.unshift(currentFolder.name);
            currentFolder = this.allFolders.find(f => f.id === currentFolder?.parent);
        }
        return pathParts.join('/');
    }

    getFileFullPath(fileId: string): string {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return '';
        if (!file.folder) return file.filename;

        const folderPath = this.getFolderFullPath(file.folder);
        return folderPath ? `${folderPath}/${file.filename}` : file.filename;
    }

    async refresh() {
        await Promise.all([
            this.loadFiles(),
            this.loadFolders(),
            this.loadQuotaInfo()
        ]);
    }

    private cleanupSubscriptions() {
        if (this.filesSubscription) {
            this.filesSubscription();
            this.filesSubscription = null;
        }
        if (this.foldersSubscription) {
            this.foldersSubscription();
            this.foldersSubscription = null;
        }
    }

    reset() {
        this.files = [];
        this.folders = [];
        this.allFolders = [];
        this.quotaInfo = null;
        this.selectedFolderId = undefined;
        this.selectedFiles = new Set();
        this.selectedFolders = new Set();
        this.loading = false;
        this.error = null;
        this.cleanupSubscriptions();
        this.currentUserId = null;
        this.isSubscribing = false;
        this.loadPromise = null;
    }
}

export const fileManagerStore = new FileManagerStore();

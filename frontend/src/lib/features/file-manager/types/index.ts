export interface FileRecord {
    id: string;
    user: string;
    filename: string;
    original_filename: string;
    file: string;
    mime_type: string;
    size: number;
    path: string;
    folder?: string;
    description?: string;
    tags?: string[];
    created: string;
    updated: string;
    collectionId?: string;
    collectionName?: string;
}

export interface FolderRecord {
    id: string;
    user: string;
    name: string;
    parent?: string;
    color?: string;
    created: string;
    updated: string;
}

export interface QuotaInfo {
    quotaBytes: number;
    usedBytes: number;
    availableBytes: number;
    percentUsed: number;
}

export interface FileFilter {
    searchQuery?: string;
    mimeType?: string;
    tags?: string[];
    path?: string;
    folder?: string;
}

export interface PreviewData {
    type: 'image' | 'pdf' | 'text' | 'unsupported';
    url: string;
    filename: string;
    mimeType: string;
}

export interface FileTreeNode {
    id: string;
    name: string;
    parent?: string;
    children: FileTreeNode[];
    level: number;
    expanded?: boolean;
}

export type SortOption = 'name' | 'date' | 'size' | 'type';
export type SortOrder = 'asc' | 'desc';
export type ViewMode = 'grid' | 'list' | 'compact';

export interface SelectionState {
    selectedFiles: Set<string>;
    isSelectionMode: boolean;
}


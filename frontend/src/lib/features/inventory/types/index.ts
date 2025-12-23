export type InventoryCategory = 'home' | 'digital' | 'pantry' | 'other';
export type InventoryItemType = 'physical_purchase' | 'subscription' | 'software_license' | 'warranty_item' | 'generic';

export interface InventoryItem {
    id: string;
    user: string;
    name: string;
    description?: string;
    category: InventoryCategory;
    item_type?: InventoryItemType;
    quantity: number;
    unit?: string;
    location?: string;
    purchase_date?: string;
    purchase_price?: number;
    warranty_expiry?: string;
    expiration_date?: string;
    license_key?: string;
    platform?: string;
    url?: string;
    subscription_end?: string;
    subscription_recurrence?: 'monthly' | 'yearly' | 'quarterly' | 'weekly' | 'one-time';
    subscription_cost?: number;
    tags?: string[];
    images?: string[];
    created: string;
    updated: string;
}

export interface LocalInventoryItem extends InventoryItem {
    localId?: string;
    syncStatus?: 'synced' | 'pending' | 'failed';
    lastModified?: number;
}

export interface InventoryFilter {
    searchQuery?: string;
    category?: InventoryCategory;
    itemType?: InventoryItemType;
    location?: string;
    showExpired?: boolean;
    showLowQuantity?: boolean;
    groupBy?: 'type' | 'category' | 'location' | 'purchase_date' | 'expiration_date' | 'none';
    sortBy?: 'name' | 'date' | 'price' | 'expiration' | 'created';
    sortOrder?: 'asc' | 'desc';
    minPrice?: number;
    maxPrice?: number;
    startDate?: string;
    endDate?: string;
    dateField?: 'purchase_date' | 'expiration_date' | 'subscription_end' | 'warranty_expiry';
}


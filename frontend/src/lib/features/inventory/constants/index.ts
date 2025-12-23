import { Package, Laptop, Utensils, Box, ShoppingCart, CreditCard, Key, Shield, FileBox } from 'lucide-svelte';
import type { InventoryCategory, InventoryItemType } from '../types';

export interface CategoryConfig {
    value: InventoryCategory;
    label: string;
    icon: typeof Package;
    color: string;
}

export const INVENTORY_CATEGORIES: CategoryConfig[] = [
    {
        value: 'home',
        label: 'Home',
        icon: Package,
        color: 'bg-primary/10 text-primary',
    },
    {
        value: 'digital',
        label: 'Digital',
        icon: Laptop,
        color: 'bg-secondary/10 text-secondary',
    },
    {
        value: 'pantry',
        label: 'Pantry',
        icon: Utensils,
        color: 'bg-accent/10 text-accent',
    },
    {
        value: 'other',
        label: 'Other',
        icon: Box,
        color: 'bg-muted/10 text-muted-foreground',
    },
];

export const INVENTORY_PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;
export const MAX_IMAGE_SIZE_MB = 5;
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

export const LOW_QUANTITY_THRESHOLD = 5;

export const CATEGORY_COLORS: Record<InventoryCategory, string> = {
    home: 'bg-primary/20 text-primary',
    digital: 'bg-secondary/20 text-secondary-foreground dark:text-secondary',
    pantry: 'bg-accent/20 text-accent',
    other: 'bg-muted text-muted-foreground',
};

export function getCategoryConfig(category: InventoryCategory): CategoryConfig {
    return INVENTORY_CATEGORIES.find(c => c.value === category) || INVENTORY_CATEGORIES[3];
}

export interface ItemTypeConfig {
    value: InventoryItemType;
    label: string;
    icon: typeof Package;
    color: string;
    description: string;
    visibleFields: {
        name: boolean;
        description: boolean;
        category: boolean;
        quantity: boolean;
        unit: boolean;
        location: boolean;
        purchase_date: boolean;
        purchase_price: boolean;
        warranty_expiry: boolean;
        expiration_date: boolean;
        license_key: boolean;
        platform: boolean;
        url: boolean;
        subscription_end: boolean;
        subscription_recurrence: boolean;
        subscription_cost: boolean;
        tags: boolean;
        images: boolean;
    };
    requiredFields: string[];
    defaultCategory: InventoryCategory;
}

export const INVENTORY_ITEM_TYPES: ItemTypeConfig[] = [
    {
        value: 'physical_purchase',
        label: 'Physical Purchase',
        icon: ShoppingCart,
        color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
        description: 'Items purchased from stores like Amazon, physical products',
        visibleFields: {
            name: true,
            description: true,
            category: true,
            quantity: true,
            unit: false,
            location: true,
            purchase_date: true,
            purchase_price: true,
            warranty_expiry: true,
            expiration_date: false,
            license_key: false,
            platform: false,
            url: false,
            subscription_end: false,
            subscription_recurrence: false,
            subscription_cost: false,
            tags: true,
            images: true,
        },
        requiredFields: ['name', 'purchase_date'],
        defaultCategory: 'home',
    },
    {
        value: 'subscription',
        label: 'Subscription',
        icon: CreditCard,
        color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
        description: 'Recurring subscriptions like Netflix, Spotify, SaaS services',
        visibleFields: {
            name: true,
            description: true,
            category: true,
            quantity: false,
            unit: false,
            location: false,
            purchase_date: false,
            purchase_price: false,
            warranty_expiry: false,
            expiration_date: false,
            license_key: false,
            platform: false,
            url: true,
            subscription_end: true,
            subscription_recurrence: true,
            subscription_cost: true,
            tags: true,
            images: false,
        },
        requiredFields: ['name', 'subscription_end'],
        defaultCategory: 'digital',
    },
    {
        value: 'software_license',
        label: 'Software License',
        icon: Key,
        color: 'bg-green-500/10 text-green-600 dark:text-green-400',
        description: 'Software licenses, activation keys, digital products',
        visibleFields: {
            name: true,
            description: true,
            category: true,
            quantity: false,
            unit: false,
            location: false,
            purchase_date: true,
            purchase_price: true,
            warranty_expiry: false,
            expiration_date: false,
            license_key: true,
            platform: true,
            url: true,
            subscription_end: false,
            subscription_recurrence: false,
            subscription_cost: false,
            tags: true,
            images: false,
        },
        requiredFields: ['name'],
        defaultCategory: 'digital',
    },
    {
        value: 'warranty_item',
        label: 'Warranty Item',
        icon: Shield,
        color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
        description: 'Items with active warranties to track',
        visibleFields: {
            name: true,
            description: true,
            category: true,
            quantity: true,
            unit: false,
            location: true,
            purchase_date: true,
            purchase_price: true,
            warranty_expiry: true,
            expiration_date: false,
            license_key: false,
            platform: false,
            url: false,
            subscription_end: false,
            subscription_recurrence: false,
            subscription_cost: false,
            tags: true,
            images: true,
        },
        requiredFields: ['name', 'warranty_expiry'],
        defaultCategory: 'home',
    },
    {
        value: 'generic',
        label: 'Generic Item',
        icon: FileBox,
        color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
        description: 'General inventory items, pantry items, or other items',
        visibleFields: {
            name: true,
            description: true,
            category: true,
            quantity: true,
            unit: true,
            location: true,
            purchase_date: true,
            purchase_price: true,
            warranty_expiry: true,
            expiration_date: true,
            license_key: true,
            platform: true,
            url: true,
            subscription_end: true,
            subscription_recurrence: false,
            subscription_cost: false,
            tags: true,
            images: true,
        },
        requiredFields: ['name'],
        defaultCategory: 'other',
    },
];

export const ITEM_TYPE_COLORS: Record<InventoryItemType, string> = {
    physical_purchase: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    subscription: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
    software_license: 'bg-green-500/20 text-green-600 dark:text-green-400',
    warranty_item: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
    generic: 'bg-gray-500/20 text-gray-600 dark:text-gray-400',
};

export function getItemTypeConfig(itemType?: InventoryItemType): ItemTypeConfig {
    if (!itemType) {
        return INVENTORY_ITEM_TYPES[4]; // generic
    }
    return INVENTORY_ITEM_TYPES.find(t => t.value === itemType) || INVENTORY_ITEM_TYPES[4];
}

export function inferItemType(item: Partial<{ category: InventoryCategory; subscription_end?: string; license_key?: string; warranty_expiry?: string; purchase_date?: string }>): InventoryItemType {
    // Infer type from existing fields for backward compatibility
    if (item.subscription_end) {
        return 'subscription';
    }
    if (item.license_key || item.platform) {
        return 'software_license';
    }
    if (item.warranty_expiry && item.purchase_date) {
        return 'warranty_item';
    }
    if (item.purchase_date && item.purchase_price) {
        return 'physical_purchase';
    }
    return 'generic';
}

// Common presets for quick selection
export const COMMON_LOCATIONS = [
    'Living Room',
    'Bedroom',
    'Kitchen',
    'Office',
    'Garage',
    'Basement',
    'Attic',
    'Storage',
    'Car',
    'Other',
];

export const COMMON_PLATFORMS = [
    'Windows',
    'macOS',
    'Linux',
    'iOS',
    'Android',
    'Web',
    'Cloud',
    'Other',
];

export const COMMON_SUBSCRIPTION_PROVIDERS = [
    'Netflix',
    'Spotify',
    'Amazon Prime',
    'Disney+',
    'Hulu',
    'YouTube Premium',
    'Adobe Creative Cloud',
    'Microsoft 365',
    'Google Workspace',
    'GitHub',
    'Figma',
    'Notion',
    'Other',
];

export const COMMON_UNITS = [
    'pieces',
    'kg',
    'lbs',
    'g',
    'oz',
    'liters',
    'gallons',
    'boxes',
    'packs',
    'bottles',
];

// Item templates for quick add
export interface ItemTemplate {
    name: string;
    description?: string;
    category: InventoryCategory;
    itemType: InventoryItemType;
    defaults: Partial<InventoryItem>;
}

export const ITEM_TEMPLATES: ItemTemplate[] = [
    {
        name: 'Amazon Purchase',
        itemType: 'physical_purchase',
        category: 'home',
        defaults: {
            location: 'Home',
        },
    },
    {
        name: 'Netflix Subscription',
        itemType: 'subscription',
        category: 'digital',
        defaults: {
            url: 'https://www.netflix.com',
            subscription_recurrence: 'monthly',
        },
    },
    {
        name: 'Software License',
        itemType: 'software_license',
        category: 'digital',
        defaults: {
            platform: 'Windows',
        },
    },
    {
        name: 'Electronics with Warranty',
        itemType: 'warranty_item',
        category: 'home',
        defaults: {
            location: 'Home',
        },
    },
    {
        name: 'Pantry Item',
        itemType: 'generic',
        category: 'pantry',
        defaults: {
            location: 'Kitchen',
            unit: 'pieces',
            quantity: 1,
        },
    },
];


/**
 * Base Storage Service
 * 
 * Generic IndexedDB wrapper that eliminates duplication across feature storage services.
 * Each feature extends this and only defines their schema.
 */

export interface StoreConfig {
    name: string;
    keyPath: string;
    indexes?: Array<{ name: string; keyPath: string; unique?: boolean }>;
}

export interface DatabaseConfig {
    name: string;
    version: number;
    stores: StoreConfig[];
}

export class BaseStorageService<T extends { id: string }> {
    protected db: IDBDatabase | null = null;
    protected config: DatabaseConfig;

    constructor(config: DatabaseConfig) {
        this.config = config;
    }

    /**
     * Initialize IndexedDB
     */
    async init(): Promise<void> {
        if (this.db) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.config.name, this.config.version);

            request.onerror = () => reject(new Error(request.error?.message || 'Failed to open database'));
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create stores from config
                this.config.stores.forEach(storeConfig => {
                    if (!db.objectStoreNames.contains(storeConfig.name)) {
                        const store = db.createObjectStore(storeConfig.name, {
                            keyPath: storeConfig.keyPath,
                        });

                        // Create indexes
                        storeConfig.indexes?.forEach(index => {
                            store.createIndex(index.name, index.keyPath, {
                                unique: index.unique || false,
                            });
                        });
                    }
                });
            };
        });
    }

    /**
     * Generic save operation
     */
    async save(storeName: string, item: T): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(request.error?.message || 'Save operation failed'));
        });
    }

    /**
     * Generic batch save operation
     */
    async saveMany(storeName: string, items: T[]): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            items.forEach(item => store.put(item));

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(new Error(transaction.error?.message || 'Batch save operation failed'));
        });
    }

    /**
     * Generic get all operation
     */
    async getAll(storeName: string): Promise<T[]> {
        await this.init();
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result as T[]);
            request.onerror = () => reject(new Error(request.error?.message || 'Get all operation failed'));
        });
    }

    /**
     * Generic get by ID operation
     */
    async getById(storeName: string, id: string): Promise<T | null> {
        await this.init();
        if (!this.db) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result as T || null);
            request.onerror = () => reject(new Error(request.error?.message || 'Get by ID operation failed'));
        });
    }

    /**
     * Generic get by index operation
     */
    async getByIndex(storeName: string, indexName: string, value: any): Promise<T[]> {
        await this.init();
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => resolve(request.result as T[]);
            request.onerror = () => reject(new Error(request.error?.message || 'Get by index operation failed'));
        });
    }

    /**
     * Generic delete operation
     */
    async delete(storeName: string, id: string): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(request.error?.message || 'Delete operation failed'));
        });
    }

    /**
     * Generic clear store operation
     */
    async clear(storeName: string): Promise<void> {
        await this.init();
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(request.error?.message || 'Clear operation failed'));
        });
    }

    /**
     * Generic count operation
     */
    async count(storeName: string): Promise<number> {
        await this.init();
        if (!this.db) return 0;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(request.error?.message || 'Count operation failed'));
        });
    }
}

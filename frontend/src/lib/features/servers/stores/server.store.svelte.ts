import { browser } from '$app/environment';
import { ServerService } from '../services/server.service';
import type { Server } from '../types';

export interface ServerFilter {
    searchQuery?: string;
    isActive?: boolean;
    isReachable?: boolean;
    provider?: string;
    sshEnabled?: boolean;
}

export interface ServerSortOptions {
    field: 'name' | 'provider' | 'created' | 'is_active' | 'is_reachable';
    order: 'asc' | 'desc';
}

class ServerStore {
    servers = $state<Server[]>([]);
    selectedServer = $state<Server | null>(null);
    isLoading = $state(false);
    isRefreshing = $state(false);
    totalItems = $state(0);
    page = $state(1);
    perPage = $state(20);
    error = $state<string | null>(null);
    hasAttemptedFetch = $state(false);
    hasMorePages = $state(true);

    filter = $state<ServerFilter>({});
    sortOptions = $state<ServerSortOptions>({
        field: 'created',
        order: 'desc'
    });

    get hasServers() {
        return this.servers.length > 0;
    }

    get activeCount() {
        return this.servers.filter((s) => s.is_active).length;
    }

    get inactiveCount() {
        return this.servers.filter((s) => !s.is_active).length;
    }

    get reachableCount() {
        return this.servers.filter((s) => s.is_reachable).length;
    }

    get unreachableCount() {
        return this.servers.filter((s) => !s.is_reachable).length;
    }

    get filteredServers() {
        let result = [...this.servers];

        result.sort((a, b) => {
            let aValue: string | number | boolean;
            let bValue: string | number | boolean;

            switch (this.sortOptions.field) {
                case 'name':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'provider':
                    aValue = a.provider.toLowerCase();
                    bValue = b.provider.toLowerCase();
                    break;
                case 'created':
                    aValue = new Date(a.created).getTime();
                    bValue = new Date(b.created).getTime();
                    break;
                case 'is_active':
                    aValue = a.is_active ? 1 : 0;
                    bValue = b.is_active ? 1 : 0;
                    break;
                case 'is_reachable':
                    aValue = a.is_reachable ? 1 : 0;
                    bValue = b.is_reachable ? 1 : 0;
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) {
                return this.sortOptions.order === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return this.sortOptions.order === 'asc' ? 1 : -1;
            }
            return 0;
        });

        return result;
    }

    async fetchServers(reset = false): Promise<void> {
        if (this.isLoading && !reset) {
            return;
        }

        if (!this.hasMorePages && !reset && this.hasAttemptedFetch) {
            return;
        }

        if (reset) {
            this.page = 1;
            this.servers = [];
            this.hasMorePages = true;
        }

        this.isLoading = true;
        this.error = null;
        this.hasAttemptedFetch = true;

        try {
            const options = {
                searchQuery: this.filter.searchQuery,
                isActive: this.filter.isActive,
                isReachable: this.filter.isReachable,
                provider: this.filter.provider,
                sshEnabled: this.filter.sshEnabled
            };

            const result = await ServerService.getServers(this.page, this.perPage, options);

            if (!result) {
                this.error = 'Failed to fetch servers';
                this.hasMorePages = false;
                this.isLoading = false;
                return;
            }

            if (result.items.length === 0) {
                this.hasMorePages = false;
                if (reset) {
                    this.servers = [];
                }
                this.isLoading = false;
                return;
            }

            if (reset) {
                this.servers = result.items;
            } else {
                this.servers = [...this.servers, ...result.items];
            }

            this.totalItems = result.totalItems;

            const totalPages = Math.ceil(result.totalItems / this.perPage);
            this.hasMorePages = this.page < totalPages;

            if (this.hasMorePages && result.items.length > 0) {
                this.page = this.page + 1;
            } else {
                this.hasMorePages = false;
            }
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Failed to fetch servers';
            this.hasMorePages = false;
            console.error('Failed to fetch servers:', error);
        } finally {
            this.isLoading = false;
        }
    }

    async refreshServers(): Promise<void> {
        this.isRefreshing = true;
        try {
            await this.fetchServers(true);
        } finally {
            this.isRefreshing = false;
        }
    }

    async searchServers(query: string): Promise<void> {
        if (this.isLoading) {
            return;
        }
        
        this.filter = { ...this.filter, searchQuery: query };
        await this.fetchServers(true);
    }

    async selectServer(server: Server | null) {
        if (!server) {
            this.selectedServer = null;
            return;
        }

        this.selectedServer = server;

        try {
            const fullServer = await ServerService.getServerById(server.id);
            if (fullServer) {
                this.selectedServer = fullServer;
                this.servers = this.servers.map((s) =>
                    s.id === server.id ? fullServer : s
                );
            }
        } catch (error) {
            console.error('Failed to fetch full server details:', error);
        }
    }

    async createServer(data: Partial<Server>): Promise<Server | null> {
        try {
            const server = await ServerService.createServer(data);
            if (server) {
                this.servers = [server, ...this.servers];
                this.totalItems = this.totalItems + 1;
            }
            return server;
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Failed to create server';
            console.error('Failed to create server:', error);
            return null;
        }
    }

    async updateServer(id: string, data: Partial<Server>): Promise<Server | null> {
        try {
            const server = await ServerService.updateServer(id, data);
            if (server) {
                this.servers = this.servers.map((s) =>
                    s.id === id ? server : s
                );
                if (this.selectedServer?.id === id) {
                    this.selectedServer = server;
                }
            }
            return server;
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Failed to update server';
            console.error('Failed to update server:', error);
            return null;
        }
    }

    async deleteServer(id: string): Promise<void> {
        try {
            await ServerService.deleteServer(id);
            const wasPresent = this.servers.some((s) => s.id === id);
            this.servers = this.servers.filter((s) => s.id !== id);
            
            if (wasPresent && this.totalItems > 0) {
                this.totalItems = Math.max(0, this.totalItems - 1);
            }
            
            if (this.selectedServer?.id === id) {
                this.selectedServer = null;
            }
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Failed to delete server';
            console.error('Failed to delete server:', error);
            throw error;
        }
    }

    async toggleStatus(id: string, isActive: boolean): Promise<void> {
        try {
            const server = await ServerService.toggleServerStatus(id, isActive);
            if (server) {
                this.servers = this.servers.map((s) =>
                    s.id === id ? server : s
                );
                if (this.selectedServer?.id === id) {
                    this.selectedServer = server;
                }
            }
        } catch (error) {
            this.error = error instanceof Error ? error.message : 'Failed to update server status';
            console.error('Failed to toggle server status:', error);
            throw error;
        }
    }

    async checkReachability(id: string): Promise<boolean> {
        try {
            const isReachable = await ServerService.checkServerReachability(id);
            this.servers = this.servers.map((s) =>
                s.id === id ? { ...s, is_reachable: isReachable } : s
            );
            if (this.selectedServer?.id === id) {
                this.selectedServer = { ...this.selectedServer, is_reachable: isReachable };
            }
            return isReachable;
        } catch (error) {
            console.error('Failed to check server reachability:', error);
            return false;
        }
    }

    setFilter(filter: Partial<ServerFilter>) {
        this.filter = { ...this.filter, ...filter };
    }

    clearFilter() {
        this.filter = {};
    }

    setSortOptions(options: Partial<ServerSortOptions>) {
        this.sortOptions = { ...this.sortOptions, ...options };
    }

    upsertServer(server: Server) {
        const index = this.servers.findIndex((s) => s.id === server.id);
        if (index >= 0) {
            this.servers[index] = server;
        } else {
            this.servers = [server, ...this.servers];
            if (this.totalItems > 0) {
                this.totalItems = this.totalItems + 1;
            }
        }
    }

    removeServer(id: string) {
        const wasPresent = this.servers.some((s) => s.id === id);
        this.servers = this.servers.filter((s) => s.id !== id);
        
        if (wasPresent && this.totalItems > 0) {
            this.totalItems = Math.max(0, this.totalItems - 1);
        }
        
        if (this.selectedServer?.id === id) {
            this.selectedServer = null;
        }
    }

    reset() {
        this.servers = [];
        this.selectedServer = null;
        this.isLoading = false;
        this.isRefreshing = false;
        this.totalItems = 0;
        this.page = 1;
        this.error = null;
        this.hasAttemptedFetch = false;
        this.hasMorePages = true;
        this.filter = {};
        this.sortOptions = {
            field: 'created',
            order: 'desc'
        };
    }
}

export const serverStore = new ServerStore();


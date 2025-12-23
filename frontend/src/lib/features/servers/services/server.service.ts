import { browser } from '$app/environment';
import { pb } from '$lib/config/pocketbase';
import { NetworkService } from '$lib/services/network.service.svelte';
import { FilterBuilder, withErrorHandling } from '$lib/utils';
import type { Server } from '../types';
import type { RecordModel } from 'pocketbase';

function convertToServer(record: RecordModel): Server {
    return {
        id: record.id,
        name: record.name,
        provider: record.provider,
        ip: record.ip,
        is_active: record.is_active ?? false,
        is_reachable: record.is_reachable ?? false,
        port: record.port ?? 22,
        username: record.username ?? '',
        security_key: record.security_key ?? '',
        ssh_enabled: record.ssh_enabled ?? false,
        created: record.created,
        updated: record.updated,
        user: record.user ?? ''
    };
}

class ServerServiceImpl {
    #cache = new Map<string, Server>();

    async getServers(
        page: number = 1,
        perPage: number = 20,
        options?: {
            searchQuery?: string;
            isActive?: boolean;
            isReachable?: boolean;
            provider?: string;
            sshEnabled?: boolean;
        }
    ): Promise<{
        items: Server[];
        totalItems: number;
        page: number;
        perPage: number;
    } | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const filterBuilder = FilterBuilder.create();

            if (options?.searchQuery?.trim()) {
                const searchTerm = options.searchQuery.trim();
                const escapedTerm = searchTerm.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                filterBuilder.or(
                    `name ~ "${escapedTerm}"`,
                    `ip ~ "${escapedTerm}"`,
                    `provider ~ "${escapedTerm}"`
                );
            }

            if (options?.isActive !== undefined) {
                filterBuilder.equals('is_active', options.isActive);
            }

            if (options?.isReachable !== undefined) {
                filterBuilder.equals('is_reachable', options.isReachable);
            }

            if (options?.provider) {
                filterBuilder.equals('provider', options.provider);
            }

            if (options?.sshEnabled !== undefined) {
                filterBuilder.equals('ssh_enabled', options.sshEnabled);
            }

            const filter = filterBuilder.build();

            const response = await pb.collection('servers').getList(page, perPage, {
                sort: '-created',
                filter: filter || undefined,
                expand: 'user'
            });

            const items = response.items.map(convertToServer);
            
            items.forEach((item) => {
                this.#cache.set(item.id, item);
            });

            return {
                items,
                totalItems: response.totalItems,
                page: response.page,
                perPage: response.perPage
            };
        } catch (error) {
            console.error('Failed to fetch servers:', error);
            return null;
        }
    }

    async getServerById(id: string): Promise<Server | null> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const cached = this.#cache.get(id);
            if (cached) {
                return cached;
            }

            const record = await pb.collection('servers').getOne(id, {
                expand: 'user'
            });
            const server = convertToServer(record);
            
            this.#cache.set(server.id, server);
            
            return server;
        } catch (error) {
            console.error('Failed to fetch server by ID:', error);
            return null;
        }
    }

    async createServer(data: Partial<Server>): Promise<Server | null> {
        const result = await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                const serverData = {
                    name: data.name,
                    provider: data.provider,
                    ip: data.ip,
                    port: data.port || 22,
                    username: data.username || '',
                    security_key: data.security_key || null,
                    ssh_enabled: !!data.ssh_enabled,
                    is_active: !!data.is_active,
                    is_reachable: !!data.is_reachable,
                    user: pb.authStore.model?.id
                };

                const record = await pb.collection('servers').create(serverData, {
                    expand: 'user'
                });
                const server = convertToServer(record);
                
                this.#cache.set(server.id, server);
                
                return server;
            },
            {
                errorMessage: 'Failed to create server',
                successMessage: 'Server created successfully',
                showToast: false, // Let store handle toasts
                logErrors: true
            }
        );
        
        return result || null;
    }

    async updateServer(id: string, data: Partial<Server>): Promise<Server | null> {
        const result = await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                const updateData: any = {};
                if (data.name !== undefined) updateData.name = data.name;
                if (data.provider !== undefined) updateData.provider = data.provider;
                if (data.ip !== undefined) updateData.ip = data.ip;
                if (data.port !== undefined) updateData.port = data.port;
                if (data.username !== undefined) updateData.username = data.username;
                if (data.security_key !== undefined) updateData.security_key = data.security_key;
                if (data.ssh_enabled !== undefined) updateData.ssh_enabled = data.ssh_enabled;
                if (data.is_active !== undefined) updateData.is_active = data.is_active;
                if (data.is_reachable !== undefined) updateData.is_reachable = data.is_reachable;

                const record = await pb.collection('servers').update(id, updateData, {
                    expand: 'user'
                });
                const server = convertToServer(record);
                
                this.#cache.set(server.id, server);
                
                return server;
            },
            {
                errorMessage: 'Failed to update server',
                successMessage: 'Server updated successfully',
                showToast: false, // Let store handle toasts
                logErrors: true
            }
        );
        
        return result || null;
    }

    async deleteServer(id: string): Promise<void> {
        const result = await withErrorHandling(
            async () => {
                if (!NetworkService.isOnline) {
                    throw new Error('Network is offline');
                }

                await pb.collection('servers').delete(id);
                
                this.#cache.delete(id);
            },
            {
                errorMessage: 'Failed to delete server',
                successMessage: 'Server deleted successfully',
                showToast: false, // Let store handle toasts
                logErrors: true
            }
        );
        
        if (result === null) {
            throw new Error('Failed to delete server');
        }
    }

    async toggleServerStatus(id: string, isActive: boolean): Promise<Server | null> {
        return this.updateServer(id, { is_active: isActive });
    }

    async checkServerReachability(id: string): Promise<boolean> {
        try {
            if (!NetworkService.isOnline) {
                throw new Error('Network is offline');
            }

            const response = await pb.send(`/api/servers/${id}/ping`, {
                method: 'POST'
            }) as any;
            
            const isReachable = response?.data?.is_reachable ?? response?.is_reachable ?? false;
            
            const cached = this.#cache.get(id);
            if (cached) {
                this.#cache.set(id, { ...cached, is_reachable: isReachable });
            }
            
            return isReachable;
        } catch (error) {
            console.error('Failed to check server reachability:', error);
            return false;
        }
    }

    getCachedServer(id: string): Server | undefined {
        return this.#cache.get(id);
    }

    clearCache() {
        this.#cache.clear();
    }
}

export const ServerService = new ServerServiceImpl();


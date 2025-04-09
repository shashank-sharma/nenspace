import { writable, get } from 'svelte/store';
import { MailService } from '../services';
import type { MailState, SyncStatus } from '../types';
import { toast } from 'svelte-sonner';
import { pb } from '$lib/config/pocketbase';
import { browser } from '$app/environment';

function createMailStore() {
    const { subscribe, update } = writable<MailState>({
        isAuthenticated: false,
        isLoading: false,
        isAuthenticating: false,
        syncStatus: null,
        lastChecked: null,
        syncAvailable: false
    });

    const STATUS_CHECK_INTERVAL = 30000;

    const store = {
        subscribe,
        
        checkStatus: async (force = false) => {
            if (!browser) return null;

            const currentState = get({ subscribe });
            const now = Date.now();

            if (!force && currentState.lastChecked) {
                if (now - currentState.lastChecked < STATUS_CHECK_INTERVAL) {
                    return currentState.syncStatus;
                }
            }

            const shouldShowLoading = force || !currentState.lastChecked;
            
            if (shouldShowLoading) {
                update(state => ({ ...state, isLoading: true }));
            }

            try {
                const status = await MailService.checkStatus();
                update(state => ({
                    ...state, 
                    isAuthenticated: !!status, 
                    isLoading: false,
                    syncStatus: status,
                    lastChecked: now,
                    syncAvailable: true
                }));
                return status;
            } catch (error: any) {
                const is404 = error?.status === 404;
                update(state => ({ 
                    ...state, 
                    isLoading: false,
                    lastChecked: now,
                    syncAvailable: !is404
                }));
                
                if (!is404) {
                    console.error('Error checking mail status:', error);
                }
                return null;
            }
        },

        startAuth: async () => {
            if (!browser) return null;

            update(state => ({ ...state, isAuthenticating: true }));
            try {
                const url = await MailService.startAuth();
                if (!url) {
                    toast.error('Failed to start authentication process');
                }
                return url;
            } catch (error) {
                toast.error('Failed to start authentication process');
                return null;
            } finally {
                update(state => ({ ...state, isAuthenticating: false }));
            }
        },

        completeAuth: async (code: string) => {
            if (!browser) return false;

            try {
                update(state => ({ ...state, isAuthenticating: true }));
                
                const result = await pb.send('/api/mail/auth/callback', {
                    method: 'POST',
                    body: { code }
                });

                // Force a fresh status check after auth
                const status = await store.checkStatus(true);
                
                if (status) {
                    // Start sync subscription if available
                    if (status && store.getState().syncAvailable) {
                        store.subscribeToChanges();
                    }
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Auth completion error:', error);
                return false;
            } finally {
                update(state => ({ ...state, isAuthenticating: false }));
            }
        },

        getState: () => get({ subscribe }),

        subscribeToChanges: () => {
            if (!browser) return;

            const currentState = get({ subscribe });
            // Only subscribe if sync is available and we have a sync status
            if (currentState.syncAvailable && currentState.syncStatus?.id) {
                try {
                    pb.collection('mail_sync').subscribe(currentState.syncStatus.id, (e) => {
                        const record = e.record;
                        update(state => ({
                            ...state, 
                            syncStatus: {
                                id: record.id,
                                status: record.sync_status,
                                last_synced: record.last_synced,
                                message_count: record.message_count || 0
                            },
                            lastChecked: Date.now(),
                        }));
                    });
                } catch (error) {
                    console.error('Failed to subscribe to mail changes:', error);
                }
            }
        },

        unsubscribe: () => {
            if (!browser) return;

            const currentState = get({ subscribe });
            // Only attempt to unsubscribe if sync was available
            if (currentState.syncAvailable) {
                try {
                    pb.collection('mail_sync').unsubscribe();
                } catch (error) {
                    console.error('Error unsubscribing from mail changes:', error);
                }
            }
        },

        setAuthenticated: (isAuthenticated: boolean) =>
            update((state) => ({ ...state, isAuthenticated })),
        setLoading: (isLoading: boolean) =>
            update((state) => ({ ...state, isLoading })),
        setAuthenticating: (isAuthenticating: boolean) =>
            update((state) => ({ ...state, isAuthenticating })),
        setSyncStatus: (syncStatus: SyncStatus | null) =>
            update((state) => ({ ...state, syncStatus })),
        reset: () =>
            update(() => ({
                isAuthenticated: false,
                isLoading: false,
                isAuthenticating: false,
                syncStatus: null,
                lastChecked: null,
                syncAvailable: false
            }))
    };

    return store;
}

export const mailStore = createMailStore();
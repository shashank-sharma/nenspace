import { writable, get } from 'svelte/store';
import type { MailMessage, MailMessagesState } from '../types';
import { toast } from 'svelte-sonner';
import { pb } from '$lib/config/pocketbase';
import { mailStore } from './mail.store';
import { MailService } from '../services';
import { browser } from '$app/environment';

function createMailMessagesStore() {
    const { subscribe, update } = writable<MailMessagesState>({
        messages: [],
        isLoading: false,
        totalItems: 0,
        page: 1,
        perPage: 20,
        selectedMail: null
    });

    const store = {
        subscribe,
        setMessages: (messages: MailMessage[]) =>
            update((state) => ({ ...state, messages })),
        setLoading: (isLoading: boolean) =>
            update((state) => ({ ...state, isLoading })),
        setTotalItems: (totalItems: number) =>
            update((state) => ({ ...state, totalItems })),
        setPage: (page: number) => update((state) => ({ ...state, page })),
        selectMail: (mail: MailMessage) =>
            update((state) => ({ ...state, selectedMail: mail })),
        reset: () =>
            update(() => ({
                messages: [],
                isLoading: false,
                totalItems: 0,
                page: 1,
                perPage: 20,
                selectedMail: null
            })),
        getState: () => get({ subscribe }),
        
        async fetchMails(page?: number) {
            if (!browser) return;

            const currentState = get({ subscribe });
            update(state => ({ ...state, isLoading: true }));
            
            try {
                const result = await MailService.fetchMails(page || currentState.page);
                update(state => ({
                    ...state,
                    messages: result.items,
                    totalItems: result.totalItems,
                    page: page || currentState.page,
                    isLoading: false
                }));
            } catch (error) {
                console.error('Error fetching mails:', error);
                update(state => ({ ...state, isLoading: false }));
            }
        },
        
        async searchMails(query: string) {
            if (!browser || !query.trim()) return;
            
            update(state => ({ ...state, isLoading: true }));
            
            try {
                // Use the pb client to search for emails matching the query
                const result = await pb.collection('mail_messages').getList(1, 20, {
                    filter: `subject~"${query}" || sender~"${query}" || body~"${query}"`,
                    sort: '-date'
                });
                
                update(state => ({
                    ...state,
                    messages: result.items as unknown as MailMessage[],
                    totalItems: result.totalItems,
                    page: 1,
                    isLoading: false
                }));
                
                if (result.items.length === 0) {
                    toast.info(`No emails found matching "${query}"`);
                }
            } catch (error) {
                console.error('Error searching mails:', error);
                toast.error('Failed to search emails');
                update(state => ({ ...state, isLoading: false }));
            }
        },
        
        markAsRead: async (messageId: string) => {
            if (!browser) return;

            try {
                await pb.collection('mail_messages').update(messageId, {
                    is_unread: false
                });

                update(state => ({
                    ...state,
                    messages: state.messages.map(msg => 
                        msg.id === messageId ? { ...msg, is_unread: false } : msg
                    )
                }));
            } catch (error) {
                toast.error('Failed to mark email as read');
            }
        },
        
        refreshMails: async () => {
            if (!browser) return;

            try {
                await pb.send('/api/mail/sync', { method: 'POST' });
                toast.success('Mail sync initiated');
                await store.fetchMails();
                toast.success('Mail sync completed');
            } catch (error) {
                toast.error('Failed to sync emails');
            }
        },
        
        subscribeToChanges: () => {
            if (!browser) return;

            // Check mail store sync availability before subscribing
            const mailState = get(mailStore);
            if (mailState.syncAvailable) {
                try {
                    pb.collection('mail_messages').subscribe('*', () => {
                        store.fetchMails();
                    });
                } catch (error) {
                    console.error('Failed to subscribe to mail messages:', error);
                }
            }
        },
        
        unsubscribe: () => {
            if (!browser) return;

            const mailState = get(mailStore);
            if (mailState.syncAvailable) {
                try {
                    pb.collection('mail_messages').unsubscribe();
                } catch (error) {
                    console.error('Error unsubscribing from mail messages:', error);
                }
            }
        }
    };

    return store;
}

export const mailMessagesStore = createMailMessagesStore();
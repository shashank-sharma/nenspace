

import { BaseStorageService } from '$lib/services/base-storage.service';
import type { LocalConversation, LocalChatMessage } from '../types';

const STORE_CONVERSATIONS = 'conversations';
const STORE_MESSAGES = 'messages';

class ChatStorageServiceImpl extends BaseStorageService<LocalConversation | LocalChatMessage> {
    constructor() {
        super({
            name: 'nen_space_ai_chat',
            version: 1,
            stores: [
                {
                    name: STORE_CONVERSATIONS,
                    keyPath: 'id',
                    indexes: [
                        { name: 'syncStatus', keyPath: 'syncStatus' },
                        { name: 'user', keyPath: 'user' },
                        { name: 'archived', keyPath: 'archived' },
                        { name: 'is_favorite', keyPath: 'is_favorite' },
                        { name: 'model', keyPath: 'model' },
                        { name: 'updated', keyPath: 'updated' },
                    ],
                },
                {
                    name: STORE_MESSAGES,
                    keyPath: 'id',
                    indexes: [
                        { name: 'syncStatus', keyPath: 'syncStatus' },
                        { name: 'conversation', keyPath: 'conversation' },
                        { name: 'role', keyPath: 'role' },
                        { name: 'created', keyPath: 'created' },
                    ],
                },
            ],
        });
    }

    async saveConversation(conversation: LocalConversation): Promise<void> {
        return this.save(STORE_CONVERSATIONS, conversation);
    }

    async getConversation(conversationId: string): Promise<LocalConversation | null> {
        return this.getById(STORE_CONVERSATIONS, conversationId) as Promise<LocalConversation | null>;
    }

    async getAllConversations(userId?: string): Promise<LocalConversation[]> {
        if (userId) {
            return this.getByIndex(STORE_CONVERSATIONS, 'user', userId) as Promise<LocalConversation[]>;
        }
        return this.getAll(STORE_CONVERSATIONS) as LocalConversation[];
    }

    async getPendingConversations(): Promise<LocalConversation[]> {
        return this.getByIndex(STORE_CONVERSATIONS, 'syncStatus', 'pending') as Promise<LocalConversation[]>;
    }

    async getFailedConversations(): Promise<LocalConversation[]> {
        const all = await this.getAll(STORE_CONVERSATIONS) as LocalConversation[];
        return all.filter(c => c.syncStatus === 'failed');
    }

    async deleteConversation(conversationId: string): Promise<void> {
        return this.delete(STORE_CONVERSATIONS, conversationId);
    }

    async updateSyncStatus(id: string, status: 'synced' | 'pending' | 'failed', storeName: 'conversations' | 'messages' = 'conversations'): Promise<void> {
        const store = storeName === 'conversations' ? STORE_CONVERSATIONS : STORE_MESSAGES;
        const item = await this.getById(store, id);
        if (!item) return;

        (item as any).syncStatus = status;
        (item as any).lastModified = Date.now();
        await this.save(store, item);
    }

    async searchConversations(query: string): Promise<LocalConversation[]> {
        const allConversations = await this.getAll(STORE_CONVERSATIONS) as LocalConversation[];
        const lowerQuery = query.toLowerCase();
        return allConversations.filter(conv =>
            conv.title.toLowerCase().includes(lowerQuery) ||
            conv.model.toLowerCase().includes(lowerQuery) ||
            conv.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }

    async saveMessage(message: LocalChatMessage): Promise<void> {
        return this.save(STORE_MESSAGES, message);
    }

    async getMessage(messageId: string): Promise<LocalChatMessage | null> {
        return this.getById(STORE_MESSAGES, messageId) as Promise<LocalChatMessage | null>;
    }

    async getMessagesByConversation(conversationId: string): Promise<LocalChatMessage[]> {
        return this.getByIndex(STORE_MESSAGES, 'conversation', conversationId) as Promise<LocalChatMessage[]>;
    }

    async getPendingMessages(): Promise<LocalChatMessage[]> {
        return this.getByIndex(STORE_MESSAGES, 'syncStatus', 'pending') as Promise<LocalChatMessage[]>;
    }

    async deleteMessage(messageId: string): Promise<void> {
        return this.delete(STORE_MESSAGES, messageId);
    }

    async deleteMessagesByConversation(conversationId: string): Promise<void> {
        const messages = await this.getMessagesByConversation(conversationId);
        await Promise.all(messages.map(msg => this.deleteMessage(msg.id)));
    }
}

export const ChatStorageService = new ChatStorageServiceImpl();

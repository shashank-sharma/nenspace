

import { BaseSyncService } from '$lib/services/base-sync.service.svelte';
import { ChatStorageService } from './chat-storage.service';
import type { LocalConversation, LocalChatMessage } from '../types';
import { ChatService } from './chat.service';
import { pb } from '$lib/config/pocketbase';
import type { SyncStorageService } from '$lib/services/base-sync.service.svelte';

class ChatConversationSyncServiceImpl extends BaseSyncService<LocalConversation> {
    protected storageService: SyncStorageService<LocalConversation> = ChatStorageService as SyncStorageService<LocalConversation>;
    protected eventName = 'chat-conversations-synced';

    protected async syncToServer(conversation: LocalConversation): Promise<LocalConversation> {
        const isLocalId = conversation.localId || conversation.id.startsWith('local_');

        if (isLocalId) {

            const { id, localId, syncStatus, lastModified, ...conversationData } = conversation;
            const created = await ChatService.createConversation(conversationData);

            await ChatStorageService.deleteConversation(conversation.id);

            return created as LocalConversation;
        } else {

            const { syncStatus, lastModified, localId, ...conversationData } = conversation;
            const updated = await ChatService.updateConversation(conversation.id, conversationData);
            return updated as LocalConversation;
        }
    }

    protected getItemDescription(conversation: LocalConversation): string {
        return `Conversation "${conversation.title}"`;
    }

    async queueConversation(conversation: LocalConversation): Promise<void> {
        return this.queueItem(conversation);
    }
}

class ChatMessageSyncServiceImpl extends BaseSyncService<LocalChatMessage> {
    protected storageService: SyncStorageService<LocalChatMessage> = ChatStorageService as SyncStorageService<LocalChatMessage>;
    protected eventName = 'chat-messages-synced';

    protected async syncToServer(message: LocalChatMessage): Promise<LocalChatMessage> {
        const isLocalId = message.localId || message.id.startsWith('local_');

        if (isLocalId) {

            const { id, localId, syncStatus, lastModified, ...messageData } = message;
            const created = await ChatService.createMessage(
                message.conversation,
                message.role,
                message.content,
                message.model_used,
                message.tokens,
                message.metadata
            );

            await ChatStorageService.deleteMessage(message.id);

            return created as LocalChatMessage;
        } else {

            const { syncStatus, lastModified, localId, conversation, ...messageData } = message;
            const updated = await ChatService.updateMessage(message.id, messageData);
            return updated as LocalChatMessage;
        }
    }

    protected getItemDescription(message: LocalChatMessage): string {
        return `Message in conversation ${message.conversation}`;
    }

    async queueMessage(message: LocalChatMessage): Promise<void> {
        return this.queueItem(message);
    }
}

export const ChatConversationSyncService = new ChatConversationSyncServiceImpl();
export const ChatMessageSyncService = new ChatMessageSyncServiceImpl();

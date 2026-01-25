

import { browser } from '$app/environment';
import { UnifiedSyncService } from '$lib/services/unified-sync.service.svelte';
import type { FeatureSyncService, UnifiedPendingItem } from '$lib/services/unified-sync.service.svelte';
import { ChatConversationSyncService, ChatMessageSyncService } from './chat-sync.service.svelte';
import { ChatStorageService } from './chat-storage.service';

const chatConversationSyncAdapter: FeatureSyncService = {
    get syncStatus() {
        return ChatConversationSyncService.syncStatus;
    },

    async getPendingItems(): Promise<UnifiedPendingItem[]> {
        const pending = await ChatStorageService.getPendingConversations();
        const failed = await ChatStorageService.getFailedConversations();

        return [
            ...pending.map(conv => ({
                id: conv.id,
                title: conv.title,
                type: 'chat-conversation',
                category: conv.model,
                syncStatus: 'pending' as const,
            })),
            ...failed.map(conv => ({
                id: conv.id,
                title: conv.title,
                type: 'chat-conversation',
                category: conv.model,
                syncStatus: 'failed' as const,
            })),
        ];
    },

    async forceSyncNow(): Promise<void> {
        await ChatConversationSyncService.forceSyncNow();
    },

    async retryFailedSyncs(): Promise<void> {
        await ChatConversationSyncService.retryFailedSyncs();
    },
};

if (browser) {
    UnifiedSyncService.register('chat-conversations', chatConversationSyncAdapter);
}

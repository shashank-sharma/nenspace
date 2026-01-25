import { pb } from '$lib/config/pocketbase';
import { ChatService } from '../services/chat.service';
import { getAttachmentsForMessages } from '../services/chat-attachment.service';
import type { Conversation, ChatMessage, TokenUsage, Checkpoint, MessageBranch } from '../types';
import type { PromptInputMessage } from '$lib/components/ai-elements/prompt-input';
import { toast } from 'svelte-sonner';
import { isAutoCancelledError, shouldShowErrorToUser, extractErrorMessage, RequestDeduplicator } from '$lib/utils';
import { goto } from '$app/navigation';

class ChatStore {
    conversations = $state<Conversation[]>([]);
    activeConversation = $state<Conversation | null>(null);
    currentConversationId = $state<string | null>(null);

    private _messagesByConversation = $state<Map<string, ChatMessage[]>>(new Map());

    get messagesByConversation(): Map<string, ChatMessage[]> {
        return this._messagesByConversation;
    }

    loadingState = $state<{
        conversations: boolean;
        currentConversation: boolean;
        sendingMessage: boolean;
    }>({ conversations: false, currentConversation: false, sendingMessage: false });

    isStreaming = $state(false);
    error = $state<{ type: string; message: string; retry?: () => void } | null>(null);
    currentStreamId = $state<string | null>(null);
    tokenUsage = $state<TokenUsage | null>(null);
    checkpoints = $state<Checkpoint[]>([]);
    messageBranches = $state<Map<string, MessageBranch>>(new Map());

    private conversationsUnsub: (() => void) | null = null;
    private messagesUnsub: (() => void) | null = null;
    private isSubscribing = false;
    private pendingSubscriptionId: string | null = null;
    loadingMessagesPromises = new Map<string, Promise<void>>();
    private streamingTimeout: ReturnType<typeof setTimeout> | null = null;
    private readonly conversationLoader = new RequestDeduplicator<string, void>();

    activeMessages = $derived.by(() => {
        if (!this.activeConversation) {
            return [];
        }
        return this.messagesByConversation.get(this.activeConversation.id) || [];
    });

    get isLoading() {
        return this.loadingState.conversations;
    }

    get isLoadingConversation() {
        return this.loadingState.currentConversation;
    }

    private upsertMessage(message: ChatMessage) {
        const conversationId = message.conversation;
        const messages = this._messagesByConversation.get(conversationId) || [];
        const existingIndex = messages.findIndex(m => m.id === message.id);

        if (existingIndex === -1) {

            const newMap = new Map(this._messagesByConversation);
            newMap.set(conversationId, [...messages, message]);
            this._messagesByConversation = newMap;
        } else {
            const updated = [...messages];
            updated[existingIndex] = message;

            const newMap = new Map(this._messagesByConversation);
            newMap.set(conversationId, updated);
            this._messagesByConversation = newMap;
        }
    }

    private removeMessage(messageId: string, conversationId: string) {
        const messages = this._messagesByConversation.get(conversationId);
        if (messages) {

            const newMap = new Map(this._messagesByConversation);
            newMap.set(conversationId, messages.filter(m => m.id !== messageId));
            this._messagesByConversation = newMap;
        }
    }

    async loadConversations(filter?: import('../types').ConversationFilter) {
        if (this.loadingState.conversations) return;

        this.loadingState.conversations = true;
        this.error = null;

        try {
            const result = await ChatService.fetchConversations(filter);
            this.conversations = result.items;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load conversations';
            this.error = {
                type: 'load_conversations',
                message: errorMessage,
                retry: () => void this.loadConversations(filter)
            };
            console.error('Failed to load conversations:', error);
        } finally {
            this.loadingState.conversations = false;
        }
    }

    async selectConversation(id: string | null, options?: { fromUrl?: boolean }) {

        const isSameConversation = id === this.currentConversationId;
        if (isSameConversation && !options?.fromUrl) {

            if (id && (!this.messagesByConversation.has(id) || this.messagesByConversation.get(id)?.length === 0)) {

            } else {
                return;
            }
        }

        this.currentConversationId = id;

        if (!id) {
            this.activeConversation = null;
            if (!options?.fromUrl) {
                await goto('/dashboard/ai-chat', { noScroll: true });
            }
            return;
        }

        const conv = this.conversations.find(c => c.id === id);
        if (conv) {
            this.activeConversation = conv;
        }

        if (!options?.fromUrl) {
            await goto(`/dashboard/ai-chat/${id}`, { noScroll: true, replaceState: false });
        }

        await this.loadConversationDetails(id);
    }

    private async loadConversationDetails(id: string): Promise<void> {

        return this.conversationLoader.dedupe(id, async () => {
            try {
                this.loadingState.currentConversation = true;
                this.error = null;

                if (this.activeConversation?.id === id && this.isStreaming) {
                    return;
                }

                if (this.activeConversation?.id !== id) {
                    this.isStreaming = false;
                    this.currentStreamId = null;
                }

                try {
                    const conversation = await ChatService.fetchConversation(id);
                    if (conversation) {
                        this.activeConversation = conversation;
                    } else {
                        this.error = {
                            type: 'load_conversation',
                            message: 'Conversation not found'
                        };
                        return;
                    }
                } catch (error) {

                    if (!isAutoCancelledError(error)) {
                        throw error;
                    }

                    console.log('Request auto-cancelled, using optimistic update');
                }

                await this.loadMessages(id);

                void this.setupRealtimeSubscriptions(id);

            } catch (error) {

                if (shouldShowErrorToUser(error)) {
                    this.error = {
                        type: 'load_conversation',
                        message: extractErrorMessage(error, 'Failed to load conversation'),
                        retry: () => void this.selectConversation(id)
                    };
                    console.error('Failed to load conversation:', error);

                    if (this.activeConversation?.id === id) {
                        this.activeConversation = null;
                    }
                }
            } finally {
                this.loadingState.currentConversation = false;
            }
        });
    }

    async loadMessages(conversationId: string) {

        const cached = this._messagesByConversation.get(conversationId);
        if (cached && cached.length > 0) {
            return;
        }

        const existingPromise = this.loadingMessagesPromises.get(conversationId);
        if (existingPromise) {
            return existingPromise;
        }

        const loadPromise = (async () => {
            try {
                const result = await ChatService.fetchMessages(conversationId);

                const messageIds = result.items.map(m => m.id);
                const attachmentsByMessage = await getAttachmentsForMessages(messageIds);

                result.items.forEach(msg => {
                    const attachments = attachmentsByMessage.get(msg.id);
                    if (attachments && attachments.length > 0) {
                        msg.metadata = {
                            ...msg.metadata,
                            files: attachments.map(att => ({
                                id: att.id,
                                name: att.name,
                                type: att.type,
                                size: att.size,
                                url: att.url
                            }))
                        };
                    }
                });

                const sortedMessages = [...result.items].sort((a, b) => {
                    const aTime = a.created ? new Date(a.created).getTime() : 0;
                    const bTime = b.created ? new Date(b.created).getTime() : 0;
                    return aTime - bTime;
                });

                const newMap = new Map(this._messagesByConversation);
                newMap.set(conversationId, sortedMessages);
                this._messagesByConversation = newMap;
            } catch (error) {
                console.error('Failed to load messages:', error);
            } finally {
                this.loadingMessagesPromises.delete(conversationId);
            }
        })();

        this.loadingMessagesPromises.set(conversationId, loadPromise);
        return loadPromise;
    }

    private async setupRealtimeSubscriptions(conversationId: string) {
        if (globalThis.window === undefined) {
            return;
        }

        if (this.isSubscribing) {
            this.pendingSubscriptionId = conversationId;
            return;
        }

        this.cleanupSubscriptions();
        this.isSubscribing = true;

        const userId = pb.authStore.model?.id;
        if (!userId) {
            this.isSubscribing = false;
            return;
        }

        try {
            const conversationsUnsub = await pb
                .collection('chat_conversations')
                .subscribe('*', (e: { action: string; record: Conversation }) => {
                    if (e.record.user !== userId) return;

                    if (e.action === 'create') {
                        this.conversations = [...this.conversations, e.record];
                    } else if (e.action === 'update') {
                        this.conversations = this.conversations.map(c =>
                            c.id === e.record.id ? e.record : c
                        );
                        if (this.activeConversation?.id === e.record.id) {
                            this.activeConversation = e.record;
                        }
                    } else if (e.action === 'delete') {
                        this.conversations = this.conversations.filter(c => c.id !== e.record.id);
                        if (this.activeConversation?.id === e.record.id) {
                            this.activeConversation = null;
                            this.messagesByConversation.delete(e.record.id);
                        }
                    }
                });

            const messagesUnsub = await pb
                .collection('chat_messages')
                .subscribe('*', (e: { action: string; record: ChatMessage }) => {
                    if (e.record.conversation !== conversationId) return;

                    if (e.action === 'create') {
                        this.upsertMessage(e.record);
                    } else if (e.action === 'update') {
                        this.upsertMessage(e.record);
                    } else if (e.action === 'delete') {
                        this.removeMessage(e.record.id, conversationId);
                    }
                });

            this.conversationsUnsub = conversationsUnsub;
            this.messagesUnsub = messagesUnsub;
        } catch (error) {
            console.error('Failed to setup realtime subscriptions:', error);
        } finally {
            this.isSubscribing = false;

            if (this.pendingSubscriptionId && this.pendingSubscriptionId !== conversationId) {
                const pending = this.pendingSubscriptionId;
                this.pendingSubscriptionId = null;
                void this.setupRealtimeSubscriptions(pending);
            }
        }
    }

    private cleanupSubscriptions() {
        if (this.conversationsUnsub) {
            this.conversationsUnsub();
            this.conversationsUnsub = null;
        }
        if (this.messagesUnsub) {
            this.messagesUnsub();
            this.messagesUnsub = null;
        }
    }

    async sendUserMessage(
        conversationId: string,
        message: PromptInputMessage,
        attachmentIds: string[] = []
    ): Promise<void> {
        if (this.loadingState.sendingMessage || this.isStreaming) {
            return;
        }

        const content = message.text?.trim() || '';
        if (!content && attachmentIds.length === 0) {
            return;
        }

        this.loadingState.sendingMessage = true;
        this.isStreaming = true;
        this.currentStreamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        this.error = null;

        const tempUserMessage: ChatMessage = {
            id: `temp_${Date.now()}`,
            conversation: conversationId,
            role: 'user',
            content,
            created: new Date().toISOString(),
            metadata: attachmentIds.length > 0 ? { files: [] } : undefined
        };

        this.upsertMessage(tempUserMessage);

        const streamTimeout = setTimeout(() => {
            if (this.isStreaming) {
                this.stopStreaming('Request timed out. Please try again.');
            }
        }, 30000);

        this.streamingTimeout = streamTimeout;

        try {
            const stream = await ChatService.sendMessage(
                conversationId,
                message,
                this.currentStreamId,
                attachmentIds
            );

            const reader = stream.getReader();
            const decoder = new TextDecoder();

            let totalTokens = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    this.stopStreaming();
                    break;
                }

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;

                    const dataStr = line.slice(6);
                    if (dataStr === '[DONE]') {
                        this.stopStreaming();
                        break;
                    }

                    try {
                        const chunkData = JSON.parse(dataStr);

                        if (chunkData.tokens) {
                            totalTokens = chunkData.tokens;
                        }

                        if (chunkData.done) {
                            this.stopStreaming();
                            break;
                        }

                        if (chunkData.error) {
                            this.stopStreaming(chunkData.error);
                            break;
                        }
                    } catch (parseError) {
                        console.error('[Frontend] Failed to parse chunk:', parseError, 'rawDataStr:', dataStr);
                    }
                }
            }

            await this.loadMessages(conversationId);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
            this.stopStreaming(errorMessage);
            console.error('Failed to send message:', error);

            this.removeMessage(tempUserMessage.id, conversationId);
        } finally {
            if (this.streamingTimeout) {
                clearTimeout(this.streamingTimeout);
                this.streamingTimeout = null;
            }
            this.loadingState.sendingMessage = false;
        }
    }

    private stopStreaming(errorMessage?: string) {
        this.isStreaming = false;
        this.currentStreamId = null;

        if (this.streamingTimeout) {
            clearTimeout(this.streamingTimeout);
            this.streamingTimeout = null;
        }

        if (errorMessage) {
            this.error = {
                type: 'send_message',
                message: errorMessage
            };
            toast.error(errorMessage);
        }
    }

    updateConversationInPlace(id: string, updates: Partial<Conversation>) {
        this.conversations = this.conversations.map(c =>
            c.id === id ? { ...c, ...updates } : c
        );

        if (this.activeConversation?.id === id) {
            this.activeConversation = { ...this.activeConversation, ...updates };
        }
    }

    addCheckpoint(messageId: string, title?: string) {
        if (!this.activeConversation) return;

        const checkpoint: Checkpoint = {
            id: `checkpoint_${Date.now()}`,
            messageId,
            conversationId: this.activeConversation.id,
            title,
            created: new Date().toISOString()
        };

        this.checkpoints = [...this.checkpoints, checkpoint];
    }

    async restoreCheckpoint(checkpointId: string) {
        const checkpoint = this.checkpoints.find(c => c.id === checkpointId);
        if (!checkpoint || !this.activeConversation) return;

        const conversationId = this.activeConversation.id;
        const messages = this.messagesByConversation.get(conversationId) || [];
        const messageIndex = messages.findIndex(m => m.id === checkpoint.messageId);
        if (messageIndex === -1) return;

        const restoredMessages = messages.slice(0, messageIndex + 1);

        const newMap = new Map(this._messagesByConversation);
        newMap.set(conversationId, restoredMessages);
        this._messagesByConversation = newMap;
    }

    addMessageBranch(messageId: string, newMessage: ChatMessage) {
        const existing = this.messageBranches.get(messageId);
        if (existing) {
            existing.branches.push(newMessage);
            this.messageBranches.set(messageId, { ...existing });
        } else {
            this.messageBranches.set(messageId, {
                messageId,
                branches: [newMessage],
                currentIndex: 0
            });
        }
    }

    updateTokenUsage(usage: TokenUsage) {
        this.tokenUsage = usage;
    }

    reset() {
        this.cleanupSubscriptions();
        this.conversations = [];
        this.activeConversation = null;
        this.currentConversationId = null;
        this._messagesByConversation = new Map();
        this.loadingState = { conversations: false, currentConversation: false, sendingMessage: false };
        this.isStreaming = false;
        this.error = null;
        this.currentStreamId = null;
        this.tokenUsage = null;
        this.checkpoints = [];
        this.messageBranches = new Map();
        this.loadingMessagesPromises.clear();
        this.conversationLoader.clearAll();

        if (this.streamingTimeout) {
            clearTimeout(this.streamingTimeout);
            this.streamingTimeout = null;
        }
    }
}

export const chatStore = new ChatStore();

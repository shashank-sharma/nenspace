import { pb } from '$lib/config/pocketbase';
import type { Conversation, ChatMessage, ConversationFilter, ModelInfo, ModelPreset, ChatSettings } from '../types';
import { NetworkService } from '$lib/services/network.service.svelte';
import { FilterBuilder } from '$lib/utils';
import { CONVERSATIONS_PAGE_SIZE, MESSAGES_PAGE_SIZE, DEFAULT_MODEL } from '../constants';
import type { PromptInputMessage } from '$lib/components/ai-elements/prompt-input';
import type { ChatAttachmentMetadata } from './chat-attachment.service';

export class ChatService {
    static async fetchConversations(filter?: ConversationFilter, page = 1, perPage = CONVERSATIONS_PAGE_SIZE): Promise<{ items: Conversation[]; totalItems: number; totalPages: number }> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            return { items: [], totalItems: 0, totalPages: 0 };
        }

        const filterBuilder = FilterBuilder.create().equals('user', userId);

        if (filter?.archived !== undefined) {
            filterBuilder.equals('archived', filter.archived);
        }

        if (filter?.favorite !== undefined) {
            filterBuilder.equals('is_favorite', filter.favorite);
        }

        if (filter?.model) {
            filterBuilder.equals('model', filter.model);
        }

        if (filter?.tags && filter.tags.length > 0) {
            filterBuilder.in('tags', filter.tags);
        }

        const filterStr = filterBuilder.build();

        const result = await pb.collection('chat_conversations').getList(page, perPage, {
            sort: '-updated',
            filter: filterStr,
        });

        return {
            items: result.items as Conversation[],
            totalItems: result.totalItems,
            totalPages: result.totalPages,
        };
    }

    static async fetchConversation(conversationId: string): Promise<Conversation | null> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            return null;
        }

        try {
            const conversation = await pb.collection('chat_conversations').getOne(conversationId);

            if ((conversation as Conversation).user !== userId) {
                throw new Error('Unauthorized');
            }

            return conversation as Conversation;
        } catch (error) {
            console.error('Failed to fetch conversation:', error);
            return null;
        }
    }

    static async createConversation(data: Partial<Conversation>): Promise<Conversation> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const conversationData = {
            user: userId,
            title: data.title || 'New Conversation',
            model: data.model || DEFAULT_MODEL,
            system_prompt: data.system_prompt || '',
            settings: data.settings || {},
            is_favorite: false,
            tags: data.tags || [],
            archived: false,
        };

        const created = await pb.collection('chat_conversations').create(conversationData);
        return created as Conversation;
    }

    static async updateConversation(conversationId: string, updates: Partial<Conversation>): Promise<Conversation> {
        const updated = await pb.collection('chat_conversations').update(conversationId, updates);
        return updated as Conversation;
    }

    static async deleteConversation(conversationId: string): Promise<void> {
        await pb.collection('chat_conversations').delete(conversationId);
    }

    static async fetchMessages(conversationId: string, page = 1, perPage = MESSAGES_PAGE_SIZE): Promise<{ items: ChatMessage[]; totalItems: number; totalPages: number }> {
        const filter = FilterBuilder.create()
            .equals('conversation', conversationId)
            .build();

        const result = await pb.collection('chat_messages').getList(page, perPage, {
            sort: 'created',
            filter,
        });

        return {
            items: result.items as ChatMessage[],
            totalItems: result.totalItems,
            totalPages: result.totalPages,
        };
    }

    static async createMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string, modelUsed?: string, tokens?: number, metadata?: Record<string, any>): Promise<ChatMessage> {
        const messageData = {
            conversation: conversationId,
            role,
            content,
            model_used: modelUsed || null,
            tokens: tokens || null,
            metadata: metadata || {},
        };

        const created = await pb.collection('chat_messages').create(messageData);
        return created as ChatMessage;
    }

    static async updateMessage(messageId: string, updates: Partial<ChatMessage>): Promise<ChatMessage> {
        const updated = await pb.collection('chat_messages').update(messageId, updates);
        return updated as ChatMessage;
    }

    static async sendMessage(
        conversationId: string,
        message: PromptInputMessage | string,
        streamId?: string,
        attachmentIds?: string[]
    ): Promise<ReadableStream<Uint8Array>> {
        const url = `${pb.baseUrl}/api/chat/conversations/${conversationId}/messages`;

        if (!pb.authStore.token) {
            throw new Error('Not authenticated: No token available');
        }

        const content = typeof message === 'string' ? message : (message.text || '');

        const requestBody: {
            content: string;
            stream_id?: string;
            attachment_ids?: string[];
        } = {
            content,
            ...(streamId && { stream_id: streamId }),
            ...(attachmentIds && attachmentIds.length > 0 && { attachment_ids: attachmentIds })
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pb.authStore.token}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            let errorText = response.statusText;
            try {
                const errorData = await response.json().catch(() => null);
                if (errorData && errorData.message) {
                    errorText = errorData.message;
                } else {
                    errorText = await response.text().catch(() => response.statusText);
                }
            } catch {
                errorText = await response.text().catch(() => response.statusText);
            }

            console.error('Chat API error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
                url,
            });

            if (response.status === 400) {
                throw new Error(errorText || 'Invalid request. Please check your message and attachments.');
            } else if (response.status === 401) {
                throw new Error('Authentication failed. Please log in again.');
            } else if (response.status === 404) {
                throw new Error('Conversation not found.');
            } else {
                throw new Error(errorText || `Failed to send message: ${response.status} ${response.statusText}`);
            }
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        return response.body;
    }

    static async listModels(): Promise<ModelInfo[]> {
        const data = await pb.send('/api/chat/models', {
            method: 'GET',
        });

        return (data as any)?.data?.models || [];
    }

    static async searchConversations(query: string, page = 1, perPage = CONVERSATIONS_PAGE_SIZE): Promise<{ items: Conversation[]; totalItems: number; totalPages: number }> {
        const params = new URLSearchParams({
            q: query,
            page: page.toString(),
            perPage: perPage.toString(),
        });

        const data = await pb.send(`/api/chat/search?${params}`, {
            method: 'GET',
        });

        const responseData = (data as any)?.data || data;
        return {
            items: responseData?.items || [],
            totalItems: responseData?.totalItems || 0,
            totalPages: responseData?.totalPages || 0,
        };
    }

    static async cancelStream(streamId: string): Promise<void> {
        await pb.send(`/api/chat/stream/${streamId}/cancel`, {
            method: 'POST',
        });
    }

    static async fetchModelPresets(): Promise<ModelPreset[]> {
        const data = await pb.send('/api/chat/presets', {
            method: 'GET',
        });

        return (data as any)?.data?.items || [];
    }

    static async createModelPreset(data: Partial<ModelPreset>): Promise<ModelPreset> {
        const result = await pb.send('/api/chat/presets', {
            method: 'POST',
            body: JSON.stringify(data),
        });

        return (result as any)?.data || result;
    }

    static async updateModelPreset(presetId: string, data: Partial<ModelPreset>): Promise<ModelPreset> {
        const result = await pb.send(`/api/chat/presets/${presetId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });

        return (result as any)?.data || result;
    }

    static async deleteModelPreset(presetId: string): Promise<void> {
        await pb.send(`/api/chat/presets/${presetId}`, {
            method: 'DELETE',
        });
    }

    static async fetchChatSettings(): Promise<ChatSettings | null> {
        try {
            const data = await pb.send('/api/chat/settings', {
                method: 'GET',
            });

            return (data as any)?.data || data;
        } catch (error: any) {

            if (error?.status === 404) {
                return null;
            }
            throw error;
        }
    }

    static async updateChatSettings(data: Partial<ChatSettings>): Promise<ChatSettings> {
        const result = await pb.send('/api/chat/settings', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });

        return (result as any)?.data || result;
    }
}

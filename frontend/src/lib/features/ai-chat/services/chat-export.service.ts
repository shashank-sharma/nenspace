import type { Conversation, ChatMessage } from '../types';
import { ChatService } from './chat.service';

export class ChatExportService {

    static async exportToMarkdown(conversationId: string): Promise<string> {
        const conversation = await ChatService.fetchConversation(conversationId);
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        const messagesResult = await ChatService.fetchMessages(conversationId, 1, 1000);
        const messages = messagesResult.items;

        let markdown = `# ${conversation.title}\n\n`;
        markdown += `**Model:** ${conversation.model}\n`;
        markdown += `**Created:** ${new Date(conversation.created).toLocaleString()}\n`;
        markdown += `**Updated:** ${new Date(conversation.updated).toLocaleString()}\n\n`;

        if (conversation.system_prompt) {
            markdown += `## System Prompt\n\n${conversation.system_prompt}\n\n`;
        }

        if (conversation.tags && conversation.tags.length > 0) {
            markdown += `**Tags:** ${conversation.tags.map(t => `\`${t}\``).join(', ')}\n\n`;
        }

        markdown += `---\n\n`;

        for (const message of messages) {
            const roleLabel = message.role === 'user' ? 'User' : message.role === 'assistant' ? 'Assistant' : 'System';
            markdown += `### ${roleLabel}\n\n`;
            markdown += `${message.content}\n\n`;

            if (message.tokens) {
                markdown += `*Tokens: ${message.tokens}*\n\n`;
            }

            markdown += `---\n\n`;
        }

        return markdown;
    }

    /**
     * Export conversation to JSON
     */
    static async exportToJSON(conversationId: string): Promise<string> {
        const conversation = await ChatService.fetchConversation(conversationId);
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        const messagesResult = await ChatService.fetchMessages(conversationId, 1, 1000);
        const messages = messagesResult.items;

        const exportData = {
            conversation: {
                id: conversation.id,
                title: conversation.title,
                model: conversation.model,
                system_prompt: conversation.system_prompt,
                settings: conversation.settings,
                tags: conversation.tags,
                is_favorite: conversation.is_favorite,
                archived: conversation.archived,
                created: conversation.created,
                updated: conversation.updated,
            },
            messages: messages.map(msg => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                model_used: msg.model_used,
                tokens: msg.tokens,
                metadata: msg.metadata,
                created: msg.created,
            })),
            exported_at: new Date().toISOString(),
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Download exported conversation as file
     */
    static async downloadExport(conversationId: string, format: 'markdown' | 'json'): Promise<void> {
        let content: string;
        let filename: string;
        let mimeType: string;

        if (format === 'markdown') {
            content = await this.exportToMarkdown(conversationId);
            filename = `conversation-${conversationId}.md`;
            mimeType = 'text/markdown';
        } else {
            content = await this.exportToJSON(conversationId);
            filename = `conversation-${conversationId}.json`;
            mimeType = 'application/json';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

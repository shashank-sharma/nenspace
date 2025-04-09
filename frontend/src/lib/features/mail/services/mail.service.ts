import { pb } from '$lib/config/pocketbase';
import type { MailMessage, SyncStatus } from '../types';
import type { RecordModel } from 'pocketbase';

function convertToMailMessage(record: RecordModel): MailMessage {
    return {
        id: record.id,
        message_id: record.message_id,
        thread_id: record.thread_id,
        from: record.from,
        to: record.to,
        subject: record.subject,
        snippet: record.snippet,
        body: record.body,
        is_unread: record.is_unread,
        is_important: record.is_important,
        is_starred: record.is_starred,
        is_spam: record.is_spam,
        is_inbox: record.is_inbox,
        is_trash: record.is_trash,
        is_draft: record.is_draft,
        is_sent: record.is_sent,
        internal_date: record.internal_date,
        received_date: record.received_date,
        created: record.created,
        updated: record.updated
    };
}

export class MailService {
    static async fetchMails(page: number = 1, perPage: number = 20) {
        const response = await pb.collection('mail_messages').getList(page, perPage, {
            sort: '-received_date',
            filter: 'is_trash = false'
        });

        return {
            items: response.items.map(convertToMailMessage),
            totalItems: response.totalItems
        };
    }

    static async markAsRead(id: string) {
        await pb.collection('mail_messages').update(id, {
            is_unread: false
        });
    }

    static async toggleStar(id: string, isStarred: boolean) {
        await pb.collection('mail_messages').update(id, {
            is_starred: isStarred
        });
    }

    static async moveToTrash(id: string) {
        await pb.collection('mail_messages').update(id, {
            is_trash: true
        });
    }

    static async moveToArchive(id: string) {
        await pb.collection('mail_messages').update(id, {
            is_inbox: false
        });
    }

    static async getSyncStatus(): Promise<SyncStatus | null> {
        try {
            const record = await pb.collection('mail_sync').getFirstListItem('');
            return {
                id: record.id,
                last_synced: record.last_synced,
                message_count: record.message_count,
                status: record.status
            };
        } catch (error) {
            return null;
        }
    }

    static async checkStatus(): Promise<SyncStatus | null> {
        try {
            const response = await pb.send<SyncStatus>('/api/mail/sync/status', {
                method: 'GET'
            });
            return response;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Unknown error occurred');
        }
    }

    static async startAuth(): Promise<string | null> {
        try {
            const response = await pb.send<{ url: string }>('/auth/mail/redirect', {
                method: 'GET'
            });
            return response.url;
        } catch (error) {
            return null;
        }
    }

    static async getMessages(page: number, perPage: number): Promise<{
        items: MailMessage[];
        totalItems: number;
    }> {
        const result = await pb.collection('mail_messages').getList(page, perPage, {
            sort: '-received_date'
        });
        
        return {
            items: result.items.map(convertToMailMessage),
            totalItems: result.totalItems
        };
    }

    static async updateMessage(id: string, data: Partial<MailMessage>): Promise<void> {
        await pb.collection('mail_messages').update(id, data);
    }

    static async syncMails(): Promise<void> {
        await pb.send('/api/mail/sync', { method: 'POST' });
    }
}
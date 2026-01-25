

import type { Conversation } from '../types';
import { DateUtil } from '$lib/utils/date.util';

export interface ConversationGroup {
    label: string;
    conversations: Conversation[];
}

export function formatConversationDate(date: string | Date): string {
    return DateUtil.formatRelative(date, { includeTime: false });
}

export function groupConversationsByDate(conversations: Conversation[]): ConversationGroup[] {
    const groups: ConversationGroup[] = [];
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const thisWeek: Conversation[] = [];
    const thisMonth: Conversation[] = [];
    const older: Conversation[] = [];

    const now = new Date();
    const startOfToday = DateUtil.startOfDay(now);
    const startOfYesterday = DateUtil.startOfDay(DateUtil.add(now, -1, 'days'));
    const startOfWeek = DateUtil.startOfDay(DateUtil.add(now, -7, 'days'));
    const startOfMonth = DateUtil.startOfDay(DateUtil.add(now, -30, 'days'));

    conversations.forEach(conv => {
        const updated = new Date(conv.updated);

        if (updated >= startOfToday) {
            today.push(conv);
        } else if (updated >= startOfYesterday) {
            yesterday.push(conv);
        } else if (updated >= startOfWeek) {
            thisWeek.push(conv);
        } else if (updated >= startOfMonth) {
            thisMonth.push(conv);
        } else {
            older.push(conv);
        }
    });

    if (today.length > 0) {
        groups.push({ label: 'Today', conversations: today });
    }
    if (yesterday.length > 0) {
        groups.push({ label: 'Yesterday', conversations: yesterday });
    }
    if (thisWeek.length > 0) {
        groups.push({ label: 'This Week', conversations: thisWeek });
    }
    if (thisMonth.length > 0) {
        groups.push({ label: 'This Month', conversations: thisMonth });
    }
    if (older.length > 0) {
        groups.push({ label: 'Older', conversations: older });
    }

    return groups;
}

export function filterConversations(
    conversations: Conversation[],
    filter: {
        searchQuery?: string;
        model?: string;
        favorite?: boolean;
        archived?: boolean;
        tags?: string[];
    }
): Conversation[] {
    let result = [...conversations];

    if (filter.searchQuery?.trim()) {
        const query = filter.searchQuery.toLowerCase();
        result = result.filter(conv =>
            conv.title.toLowerCase().includes(query) ||
            conv.model.toLowerCase().includes(query) ||
            conv.tags?.some(tag => tag.toLowerCase().includes(query))
        );
    }

    if (filter.model) {
        result = result.filter(conv => conv.model === filter.model);
    }

    if (filter.favorite !== undefined) {
        result = result.filter(conv => conv.is_favorite === filter.favorite);
    }

    if (filter.tags && filter.tags.length > 0) {
        result = result.filter(conv =>
            conv.tags?.some(tag => filter.tags!.includes(tag))
        );
    }

    if (filter.archived !== undefined) {
        result = result.filter(conv => conv.archived === filter.archived);
    }

    return result;
}

export function sortConversations(
    conversations: Conversation[],
    sortBy: 'date' | 'title' | 'model' | 'favorite' = 'date',
    order: 'asc' | 'desc' = 'desc'
): Conversation[] {
    const sorted = [...conversations];

    sorted.sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
            case 'date':
                comparison = new Date(a.updated).getTime() - new Date(b.updated).getTime();
                break;
            case 'title':
                comparison = a.title.localeCompare(b.title);
                break;
            case 'model':
                comparison = a.model.localeCompare(b.model);
                break;
            case 'favorite':

                if (a.is_favorite !== b.is_favorite) {
                    comparison = a.is_favorite ? -1 : 1;
                } else {
                    comparison = new Date(b.updated).getTime() - new Date(a.updated).getTime();
                }
                break;
        }

        return order === 'asc' ? comparison : -comparison;
    });

    return sorted;
}

export function getConversationPreview(conversation: Conversation): string {

    return '';
}

export function getModelProviderIcon(provider: string): string {
    const providerIcons: Record<string, string> = {
        'openai': 'Bot',
        'anthropic': 'Bot',
        'google': 'Bot',
        'meta': 'Bot',
        'mistral': 'Bot',
    };
    return providerIcons[provider.toLowerCase()] || 'Bot';
}

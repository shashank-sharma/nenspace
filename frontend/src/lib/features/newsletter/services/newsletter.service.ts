import { pb } from '$lib/config/pocketbase';
import { FilterBuilder } from '$lib/utils';
import type { Newsletter, NewsletterSettings, NewsletterFilter } from '../types';
import { NEWSLETTER_PAGE_SIZE } from '../constants';

export class NewsletterService {
    /**
     * Get newsletter settings for the current user
     */
    static async getSettings(): Promise<NewsletterSettings | null> {
        const userId = pb.authStore.model?.id;
        if (!userId) return null;

        const filter = FilterBuilder.create().equals('user', userId).build();
        
        try {
            return await pb.collection('newsletter_settings').getFirstListItem(filter);
        } catch (error) {
            // If not found, return null
            return null;
        }
    }
    
    /**
     * Enable newsletter detection for the current user
     */
    static async enableNewsletter(): Promise<NewsletterSettings> {
        const userId = pb.authStore.model?.id;
        if (!userId) throw new Error('User not authenticated');

        const existing = await this.getSettings();
        
        if (existing) {
            return await pb.collection('newsletter_settings').update(existing.id, {
                is_enabled: true
            });
        } else {
            return await pb.collection('newsletter_settings').create({
                user: userId,
                is_enabled: true
            });
        }
    }

    /**
     * Disable newsletter detection for the current user
     */
    static async disableNewsletter(): Promise<NewsletterSettings> {
        const userId = pb.authStore.model?.id;
        if (!userId) throw new Error('User not authenticated');

        const existing = await this.getSettings();
        if (!existing) throw new Error('Newsletter settings not found');

        return await pb.collection('newsletter_settings').update(existing.id, {
            is_enabled: false
        });
    }
    
    /**
     * Get detected newsletters with filtering and pagination
     */
    static async getNewsletters(filter?: NewsletterFilter, page: number = 1): Promise<{
        items: Newsletter[];
        totalItems: number;
        totalPages: number;
    }> {
        const userId = pb.authStore.model?.id;
        if (!userId) throw new Error('User not authenticated');

        const filterBuilder = FilterBuilder.create().equals('user', userId);
        
        if (filter?.searchQuery) {
            const escaped = filter.searchQuery.replace(/"/g, '\\"');
            filterBuilder.or(
                `name ~ "${escaped}"`,
                `sender_email ~ "${escaped}"`,
                `sender_name ~ "${escaped}"`
            );
        }
        
        if (filter?.isActive !== undefined) {
            filterBuilder.equals('is_active', filter.isActive);
        }
        
        const result = await pb.collection('newsletters').getList(page, NEWSLETTER_PAGE_SIZE, {
            sort: filter?.sort || '-last_seen',
            filter: filterBuilder.build(),
        });
        
        return {
            items: result.items as unknown as Newsletter[],
            totalItems: result.totalItems,
            totalPages: result.totalPages
        };
    }

    /**
     * Get a single newsletter by ID
     */
    static async getNewsletterById(id: string): Promise<Newsletter> {
        return await pb.collection('newsletters').getOne(id) as unknown as Newsletter;
    }

    /**
     * Toggle active status of a newsletter
     */
    static async toggleActive(id: string, isActive: boolean): Promise<Newsletter> {
        return await pb.collection('newsletters').update(id, {
            is_active: isActive
        }) as unknown as Newsletter;
    }

    /**
     * Trigger a manual newsletter scan
     */
    static async startScan(): Promise<void> {
        await pb.send('/api/newsletter/scan', { method: 'POST' });
    }
}


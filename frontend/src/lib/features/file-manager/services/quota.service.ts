import { pb } from '$lib/config/pocketbase';
import { FilterBuilder } from '$lib/utils';
import type { QuotaInfo } from '../types';
import { DEFAULT_QUOTA_BYTES } from '../constants';

export class QuotaService {
    static async getQuotaInfo(userId: string): Promise<QuotaInfo> {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const filter = FilterBuilder.create()
            .equals('user', userId)
            .build();

        const result = await pb.collection('user_storage_quotas').getFirstListItem(filter).catch(() => null);

        const quotaBytes = result?.quota_bytes || DEFAULT_QUOTA_BYTES;
        const usedBytes = result?.used_bytes || 0;
        const availableBytes = Math.max(0, quotaBytes - usedBytes);
        const percentUsed = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;

        return {
            quotaBytes,
            usedBytes,
            availableBytes,
            percentUsed: Math.round(percentUsed * 100) / 100
        };
    }

    static async checkQuotaAvailable(userId: string, fileSize: number): Promise<boolean> {
        if (!userId) {
            throw new Error('User ID is required');
        }

        if (fileSize <= 0) {
            throw new Error('File size must be greater than 0');
        }

        const quotaInfo = await this.getQuotaInfo(userId);
        return quotaInfo.availableBytes >= fileSize;
    }

    static async updateQuotaUsage(userId: string, deltaBytes: number): Promise<void> {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const filter = FilterBuilder.create()
            .equals('user', userId)
            .build();

        const existing = await pb.collection('user_storage_quotas').getFirstListItem(filter).catch(() => null);

        if (existing) {
            const newUsedBytes = Math.max(0, (existing.used_bytes || 0) + deltaBytes);
            await pb.collection('user_storage_quotas').update(existing.id, {
                used_bytes: newUsedBytes
            });
        } else {
            const quotaBytes = DEFAULT_QUOTA_BYTES;
            const usedBytes = Math.max(0, deltaBytes);
            await pb.collection('user_storage_quotas').create({
                user: userId,
                quota_bytes: quotaBytes,
                used_bytes: usedBytes
            });
        }
    }

    static async setQuota(userId: string, quotaBytes: number): Promise<void> {
        if (!userId) {
            throw new Error('User ID is required');
        }

        if (quotaBytes < 0) {
            throw new Error('Quota must be greater than or equal to 0');
        }

        const filter = FilterBuilder.create()
            .equals('user', userId)
            .build();

        const existing = await pb.collection('user_storage_quotas').getFirstListItem(filter).catch(() => null);

        if (existing) {
            await pb.collection('user_storage_quotas').update(existing.id, {
                quota_bytes: quotaBytes
            });
        } else {
            await pb.collection('user_storage_quotas').create({
                user: userId,
                quota_bytes: quotaBytes,
                used_bytes: 0
            });
        }
    }
}


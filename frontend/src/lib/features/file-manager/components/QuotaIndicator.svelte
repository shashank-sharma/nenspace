<script lang="ts">
    import { Progress } from '$lib/components/ui/progress';
    import { formatFileSize } from '$lib/utils/file-validation.util';
    import type { QuotaInfo } from '../types';

    let { quotaInfo } = $props<{
        quotaInfo: QuotaInfo;
    }>();

    const progressColor = $derived.by(() => {
        if (quotaInfo.percentUsed >= 90) {
            return 'bg-destructive';
        }
        if (quotaInfo.percentUsed >= 75) {
            return 'bg-yellow-500';
        }
        return 'bg-primary';
    });
</script>

<div class="rounded-lg border bg-card p-4">
    <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-medium">Storage Quota</h3>
        <span class="text-sm text-muted-foreground">
            {quotaInfo.percentUsed.toFixed(1)}% used
        </span>
    </div>

    <Progress
        value={quotaInfo.percentUsed}
        max={100}
        class="mb-2"
    />

    <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatFileSize(quotaInfo.usedBytes)} of {formatFileSize(quotaInfo.quotaBytes)}</span>
        <span>{formatFileSize(quotaInfo.availableBytes)} available</span>
    </div>
</div>


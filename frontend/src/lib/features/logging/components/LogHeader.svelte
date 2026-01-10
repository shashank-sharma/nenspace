<script lang="ts">
    import { ScrollText, Activity, Layers, Database } from 'lucide-svelte';
    import { Badge } from '$lib/components/ui/badge';

    let { totalLogs = 0, realtimeCount = 0 } = $props<{ totalLogs?: number; realtimeCount?: number }>();
</script>

<div class="flex items-center justify-between px-6 py-4 bg-background border-b">
    <div class="flex items-center gap-4">
        <div class="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <ScrollText class="h-6 w-6" />
        </div>
        <div>
            <h1 class="text-xl font-bold tracking-tight">Logs Explorer</h1>
            <p class="text-xs text-muted-foreground font-medium flex items-center gap-2">
                <Activity class="h-3 w-3" /> Aggregating logs from multiple projects
            </p>
        </div>
    </div>

    <div class="flex items-center gap-6">
        <div class="flex flex-col items-end">
            <span class="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Stored</span>
            <div class="flex items-center gap-2">
                <Database class="h-3.5 w-3.5 text-muted-foreground" />
                <span class="text-lg font-mono font-bold">{totalLogs.toLocaleString()}</span>
            </div>
        </div>

        <div class="h-8 w-px bg-border"></div>

        <div class="flex flex-col items-end">
            <span class="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Session Stream</span>
            <div class="flex items-center gap-2">
                <Layers class="h-3.5 w-3.5 text-blue-500" />
                <span class="text-lg font-mono font-bold text-blue-500">{realtimeCount}</span>
            </div>
        </div>
    </div>
</div>


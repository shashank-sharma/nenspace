<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { Clock } from 'lucide-svelte';
    import BaseView from './BaseView.svelte';
    import type { SystemStatus } from '../../utils/status-indicator.util';
    import { getStatusIndicatorState } from '../../utils/status-indicator.util';

    let { systemStatus } = $props<{ systemStatus: SystemStatus }>();
    
    let currentTime = $state("");
    let timer: NodeJS.Timeout;

    let statusState = $derived(getStatusIndicatorState(systemStatus));

    function updateTime() {
        const now = new Date();
        currentTime = now.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    }

    onMount(() => {
        updateTime();
        timer = setInterval(updateTime, 1000);
    });

    onDestroy(() => {
        clearInterval(timer);
    });
</script>

<BaseView id="time">
    {@const StatusIcon = statusState.icon || Clock}
    <div class="flex items-center justify-center gap-2 px-3 h-full select-none">
        <div class={statusState.iconColor}>
            <StatusIcon size={14} />
        </div>
        <div class="text-xs font-semibold text-white tracking-tight">
            {currentTime}
        </div>
    </div>
</BaseView>

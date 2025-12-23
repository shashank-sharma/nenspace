<script lang="ts">
    import { Badge } from '$lib/components/ui/badge';
    import { STATUS_COLORS, WORKFLOW_STATUS } from '../constants';
    import type { WorkflowExecution } from '../types';

    export let status: WorkflowExecution['status'] | undefined;
    export let size: 'sm' | 'md' | 'lg' = 'md';

    $: color = status ? STATUS_COLORS[status] : STATUS_COLORS[WORKFLOW_STATUS.CANCELLED];
    $: displayStatus = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
    $: sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : size === 'lg' ? 'text-sm px-3 py-1.5' : 'text-xs px-2.5 py-1';
</script>

<Badge
    class={sizeClass}
    style="background-color: {color}; color: white; border: none;"
>
    {displayStatus}
</Badge>


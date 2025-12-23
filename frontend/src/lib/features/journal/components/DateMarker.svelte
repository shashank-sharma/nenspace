<script lang="ts">
    import { getDayLetter, getDayNumber, isToday, isWeekend } from '../utils/date.utils';
    import { cn } from '$lib/utils';

    let { date, entryCount = 0, isHighlighted = false, onClick, onDotClick } = $props<{
        date: Date;
        entryCount?: number;
        isHighlighted?: boolean;
        onClick?: () => void;
        onDotClick?: () => void;
    }>();

    const dayLetter = getDayLetter(date);
    const dayNumber = getDayNumber(date);
    const isCurrentDate = isToday(date);
    const isWeekendDay = isWeekend(date);

    function handleDotClick(e: MouseEvent) {
        e.stopPropagation();
        onDotClick?.();
    }
</script>

<div
    class={cn(
        "flex flex-row items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer",
        "hover:bg-muted",
        isCurrentDate && "text-primary",
        isWeekendDay && !isCurrentDate && "text-accent/60",
        !isWeekendDay && !isCurrentDate && "text-muted-foreground",
        isHighlighted && "bg-accent/10"
    )}
    onclick={onClick}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
        }
    }}
>
    <span class="text-xs font-medium">{dayLetter}</span>
    <span class="text-xs">{dayNumber}</span>
</div>


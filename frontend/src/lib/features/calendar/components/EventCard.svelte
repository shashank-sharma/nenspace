<script lang="ts">
    import type { CalendarEvent } from "../types";
    import { getEventTimeDisplay, formatDuration } from "../utils/date";
    import { Clock, MapPin } from "lucide-svelte";

    let { event, compact = false } = $props<{
        event: CalendarEvent;
        compact?: boolean;
    }>();

    const startDate = $derived(new Date(event.start));
    const endDate = $derived(new Date(event.end));
    const timeDisplay = $derived(
        getEventTimeDisplay(event.start, event.end, event.is_day_event),
    );
    const duration = $derived(formatDuration(startDate, endDate));
</script>

{#if compact}
    <div
        class="px-1.5 py-0.5 text-xs rounded cursor-pointer hover:bg-primary/10 transition-colors
              {event.is_day_event
            ? 'bg-primary/15 text-primary-foreground/90'
            : 'bg-secondary/50'}"
    >
        <div class="truncate font-medium">{event.summary}</div>
    </div>
{:else}
    <div
        class="p-3 bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow
              max-w-xs w-full"
    >
        <div class="space-y-2">
            <h3 class="font-medium text-lg text-card-foreground">
                {event.summary}
            </h3>

            <div
                class="flex items-center text-sm text-muted-foreground gap-1.5"
            >
                <Clock class="h-3.5 w-3.5" />
                <span>{timeDisplay}</span>
            </div>

            {#if duration && !event.is_day_event}
                <div class="text-xs text-muted-foreground">
                    Duration: {duration}
                </div>
            {/if}

            {#if event.location}
                <div
                    class="flex items-center text-sm text-muted-foreground gap-1.5"
                >
                    <MapPin class="h-3.5 w-3.5" />
                    <span class="truncate">{event.location}</span>
                </div>
            {/if}

            {#if event.description}
                <div
                    class="text-sm mt-2 border-t border-border pt-2 text-card-foreground"
                >
                    <p class="truncate">{event.description}</p>
                </div>
            {/if}
        </div>
    </div>
{/if}

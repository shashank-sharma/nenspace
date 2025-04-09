<script lang="ts">
    import type { CalendarEvent } from "../types";
    import { getEventTimeDisplay, formatDuration } from "../utils/date";
    import { Clock, MapPin } from "lucide-svelte";

    export let event: CalendarEvent;
    export let compact: boolean = false;

    $: startDate = new Date(event.start);
    $: endDate = new Date(event.end);
    $: timeDisplay = getEventTimeDisplay(
        event.start,
        event.end,
        event.is_day_event,
    );
    $: duration = formatDuration(startDate, endDate);
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
        class="p-3 bg-card border rounded-lg shadow-sm hover:shadow-md transition-shadow
              max-w-xs w-full"
    >
        <div class="space-y-2">
            <h3 class="font-medium text-lg">{event.summary}</h3>

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
                <div class="text-sm mt-2 border-t pt-2">
                    <p class="truncate">{event.description}</p>
                </div>
            {/if}
        </div>
    </div>
{/if}

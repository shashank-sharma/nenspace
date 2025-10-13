<script lang="ts">
    import type { CalendarEvent } from "../types";
    import { Clock, MapPin } from "lucide-svelte";
    import { getEventTimeColor, getEventTextColor } from "../utils/color";

    let {
        event,
        compact = false,
        maxWidth = "auto",
    } = $props<{
        event: CalendarEvent;
        compact?: boolean;
        maxWidth?: string;
    }>();

    const eventColor = $derived(getEventTimeColor(event));
    const textColor = $derived(getEventTextColor(event));

    function formatTime(date: Date | string): string {
        const d = typeof date === "string" ? new Date(date) : date;
        return d.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    }

    function getEventTimeDisplay(
        start: string,
        end: string,
        isDayEvent: boolean,
    ): string {
        if (isDayEvent) {
            return "All day";
        }

        const startDate = new Date(start);
        const endDate = new Date(end);

        if (startDate.toDateString() === endDate.toDateString()) {
            return `${formatTime(startDate)} - ${formatTime(endDate)}`;
        } else {
            const options: Intl.DateTimeFormatOptions = {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
            };

            return `${startDate.toLocaleString("en-US", options)} - ${endDate.toLocaleString("en-US", options)}`;
        }
    }

    function formatDuration(start: Date | string, end: Date | string): string {
        const startDate = typeof start === "string" ? new Date(start) : start;
        const endDate = typeof end === "string" ? new Date(end) : end;

        const durationMs = endDate.getTime() - startDate.getTime();
        const durationMinutes = Math.floor(durationMs / (1000 * 60));

        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;

        if (hours === 0) {
            return `${minutes} min${minutes !== 1 ? "s" : ""}`;
        } else if (minutes === 0) {
            return `${hours} hr${hours !== 1 ? "s" : ""}`;
        } else {
            return `${hours} hr${hours !== 1 ? "s" : ""} ${minutes} min${minutes !== 1 ? "s" : ""}`;
        }
    }

    const startDate = $derived(new Date(event.start));
    const endDate = $derived(new Date(event.end));
    const timeDisplay = $derived(
        getEventTimeDisplay(event.start, event.end, event.is_day_event),
    );
    const duration = $derived(formatDuration(startDate, endDate));
</script>

{#if compact}
    <div
        class="px-1.5 py-0.5 text-xs rounded cursor-pointer hover:opacity-90 transition-opacity {eventColor} {textColor}"
        style="max-width: {maxWidth}; overflow: hidden;"
    >
        <div class="truncate font-medium">{event.summary}</div>
        {#if !event.is_day_event}
            <div class="truncate text-[10px] opacity-90">
                {formatTime(startDate)}
            </div>
        {/if}
    </div>
{:else}
    <div
        class="p-3 bg-card border rounded-lg shadow-sm hover:shadow-md transition-shadow w-full"
        style="max-width: {maxWidth}; overflow: hidden; border-left-width: 4px;"
        class:border-yellow-400={eventColor.includes("yellow")}
        class:border-orange-400={eventColor.includes("orange")}
        class:border-purple-400={eventColor.includes("purple")}
        class:border-blue-400={eventColor.includes("blue")}
    >
        <div class="space-y-2">
            <h3 class="font-medium text-lg break-words">{event.summary}</h3>

            <div
                class="flex items-center text-sm text-muted-foreground gap-1.5"
            >
                <Clock class="h-3.5 w-3.5 flex-shrink-0" />
                <span class="truncate">{timeDisplay}</span>
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
                    <MapPin class="h-3.5 w-3.5 flex-shrink-0" />
                    <span class="truncate">{event.location}</span>
                </div>
            {/if}

            {#if event.description}
                <div class="text-sm mt-2 border-t pt-2">
                    <p class="line-clamp-3">{@html event.description}</p>
                    {#if event.description.length > 150}
                        <button
                            class="text-xs text-primary hover:underline mt-1"
                            >Show more</button
                        >
                    {/if}
                </div>
            {/if}
        </div>
    </div>
{/if}

<script lang="ts">
    import {
        Dialog as ShadcnDialog,
        DialogContent,
        DialogHeader,
        DialogTitle,
    } from "$lib/components/ui/dialog";
    import type { CalendarEvent } from "../types";
    import { formatDuration, getEventTimeDisplay } from "../utils/date";
    import { Clock, MapPin, User, Calendar } from "lucide-svelte";

    export let open: boolean = false;
    export let event: CalendarEvent | null = null;
    export let onClose: () => void;

    const eventColors = {
        default: "border-blue-400",
        meeting: "border-purple-400",
        appointment: "border-green-400",
        reminder: "border-yellow-400",
        deadline: "border-red-400",
        allDay: "border-primary",
    };

    function getEventColor(event: CalendarEvent): string {
        if (!event) return eventColors.default;
        if (event.is_day_event) return eventColors.allDay;

        const eventType = event.event_type?.toLowerCase() || "";
        const summary = event.summary?.toLowerCase() || "";

        if (eventType.includes("meeting") || summary.includes("meeting"))
            return eventColors.meeting;
        if (
            eventType.includes("appointment") ||
            summary.includes("appointment") ||
            summary.includes("doctor")
        )
            return eventColors.appointment;
        if (eventType.includes("reminder") || summary.includes("reminder"))
            return eventColors.reminder;
        if (
            eventType.includes("deadline") ||
            summary.includes("deadline") ||
            summary.includes("due")
        )
            return eventColors.deadline;

        return eventColors.default;
    }

    $: eventColor = event ? getEventColor(event) : eventColors.default;
</script>

<ShadcnDialog {open} onOpenChange={onClose}>
    <DialogContent class="max-w-md overflow-hidden">
        {#if event}
            <div
                class="px-1 {eventColor}"
                style="border-left-width: 4px; margin-left: -1rem; padding-left: 1rem;"
            >
                <DialogHeader>
                    <DialogTitle class="text-xl break-words leading-tight">
                        {event.summary}
                    </DialogTitle>
                </DialogHeader>
            </div>

            <div class="mt-4 space-y-3 px-1">
                <div class="flex items-center gap-2 text-muted-foreground">
                    <Clock class="h-4 w-4 flex-shrink-0" />
                    <span class="truncate">
                        {getEventTimeDisplay(
                            event.start,
                            event.end,
                            event.is_day_event,
                        )}
                    </span>
                </div>

                {#if !event.is_day_event}
                    <div class="text-sm text-muted-foreground">
                        Duration: {formatDuration(event.start, event.end)}
                    </div>
                {/if}

                {#if event.organizer || event.organizer_email}
                    <div class="flex items-center gap-2 text-muted-foreground">
                        <User class="h-4 w-4 flex-shrink-0" />
                        <span class="truncate">
                            {event.organizer || event.organizer_email}
                        </span>
                    </div>
                {/if}

                {#if event.location}
                    <div class="flex items-center gap-2 text-muted-foreground">
                        <MapPin class="h-4 w-4 flex-shrink-0" />
                        <span class="truncate">{event.location}</span>
                    </div>
                {/if}

                {#if event.calendar_id}
                    <div class="flex items-center gap-2 text-muted-foreground">
                        <Calendar class="h-4 w-4 flex-shrink-0" />
                        <span class="truncate">{event.calendar_id}</span>
                    </div>
                {/if}

                {#if event.description}
                    <div class="mt-4 p-3 bg-muted rounded-md">
                        <div class="max-h-[150px] overflow-y-auto text-sm">
                            {event.description}
                        </div>
                    </div>
                {/if}

                {#if event.organizer_email}
                    <div class="flex justify-start gap-2 mt-4 pt-3 border-t">
                        <a
                            href={`mailto:${event.organizer_email}`}
                            class="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                            <User class="h-3 w-3" />
                            Contact organizer
                        </a>
                    </div>
                {/if}
            </div>
        {/if}
    </DialogContent>
</ShadcnDialog>

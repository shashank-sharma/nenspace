<script lang="ts">
    import { onMount } from "svelte";
    import { fade } from "svelte/transition";
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle,
        DialogFooter,
    } from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Card } from "$lib/components/ui/card";
    import {
        Clock,
        MapPin,
        Mail,
        Calendar as CalendarIcon,
        User,
    } from "lucide-svelte";
    import { formatDuration, getEventTimeDisplay } from "../utils/date";
    import type { CalendarEvent } from "../types";
    import { getEventTimeColor } from "../utils/color";

    let {
        event = null,
        isOpen = false,
        onClose,
        position = { x: 0, y: 0 },
    } = $props<{
        event: CalendarEvent | null;
        isOpen?: boolean;
        onClose: () => void;
        position?: { x: number; y: number };
    }>();

    let isMobile = $state(false);
    let showMore = $state(false);
    let hoverCardStyles = $state("");
    let windowWidth = $state(0);
    let windowHeight = $state(0);

    $effect(() => {
        if (event) {
            checkMobile();
            setHoverCardPosition();
        }
    });

    function checkMobile() {
        isMobile = window.innerWidth < 768;
        windowWidth = window.innerWidth;
        windowHeight = window.innerHeight;
    }

    function setHoverCardPosition() {
        if (!position || isMobile) return;

        const CARD_WIDTH = 400;
        const CARD_HEIGHT = 300;
        const PADDING = 20;

        let xPos = position.x;
        if (xPos + CARD_WIDTH + PADDING > windowWidth) {
            xPos = Math.max(PADDING, windowWidth - CARD_WIDTH - PADDING);
        }

        let yPos = position.y;
        if (yPos + CARD_HEIGHT + PADDING > windowHeight) {
            yPos = Math.max(PADDING, windowHeight - CARD_HEIGHT - PADDING);
        }

        hoverCardStyles = `position: fixed; top: ${yPos}px; left: ${xPos}px; z-index: 100; width: ${CARD_WIDTH}px;`;
    }

    function getEventColor(event: CalendarEvent): string {
        if (!event) return "bg-primary";
        return getEventTimeColor(event);
    }

    function getOrganizerEmail(event: CalendarEvent): string | null {
        if (typeof event.organizer === "object" && event.organizer?.email) {
            return event.organizer.email;
        }
        if (event.organizer_email) {
            return event.organizer_email;
        }
        return null;
    }

    function getEventStartEndTimes(event: CalendarEvent) {
        const startStr = event.start_time || event.start || "";
        const endStr = event.end_time || event.end || "";
        return {
            start: startStr ? new Date(startStr) : new Date(),
            end: endStr ? new Date(endStr) : new Date(),
        };
    }

    function getOrganizerName(event: CalendarEvent): string {
        if (typeof event.organizer === "string") {
            return event.organizer;
        } else if (event.organizer && typeof event.organizer === "object") {
            return event.organizer.name || event.organizer_email || "Unknown";
        }
        return event.organizer_email || "Unknown";
    }

    onMount(() => {
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => {
            window.removeEventListener("resize", checkMobile);
        };
    });
</script>

{#if isOpen && event}
    {#if isMobile}
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent class="max-w-md overflow-hidden">
                <DialogHeader>
                    <div class="flex items-start gap-2">
                        <div
                            class="w-2 h-8 rounded-sm mt-1 {getEventColor(
                                event,
                            )}"
                        ></div>
                        <DialogTitle class="text-xl break-words">
                            {event.summary}
                        </DialogTitle>
                    </div>
                </DialogHeader>

                <div class="space-y-3">
                    <div class="flex items-start gap-3">
                        <Clock
                            class="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1"
                        />
                        <div class="flex-1">
                            <p class="truncate text-sm">
                                {getEventTimeDisplay(event)}
                            </p>
                            {#if !(event.is_all_day || event.is_day_event)}
                                {@const times = getEventStartEndTimes(event)}
                                <p class="text-xs text-muted-foreground">
                                    {formatDuration(times.start, times.end)}
                                </p>
                            {/if}
                        </div>
                    </div>

                    {#if event.location}
                        <div class="flex items-start gap-3">
                            <MapPin
                                class="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1"
                            />
                            <p class="text-sm truncate flex-1">
                                {event.location}
                            </p>
                        </div>
                    {/if}

                    {#if event.organizer || event.organizer_email}
                        <div class="flex items-start gap-3">
                            <User
                                class="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1"
                            />
                            <div class="flex-1">
                                <p class="text-sm truncate">
                                    {getOrganizerName(event)}
                                </p>
                            </div>
                        </div>
                    {/if}

                    {#if event.description}
                        <div class="mt-4 border-t pt-3">
                            <div
                                class={showMore
                                    ? "max-h-[150px] overflow-y-auto"
                                    : "max-h-[80px] overflow-hidden"}
                            >
                                <p class="text-sm line-clamp-3">
                                    {@html event.description}
                                </p>
                            </div>
                            {#if event.description.length > 200}
                                <Button
                                    variant="link"
                                    size="sm"
                                    class="px-0 mt-1"
                                    onclick={() => (showMore = !showMore)}
                                >
                                    {showMore ? "Show less" : "Show more"}
                                </Button>
                            {/if}
                        </div>
                    {/if}
                </div>

                <DialogFooter class="flex items-center justify-between">
                    <div
                        class="flex items-center text-xs text-muted-foreground"
                    >
                        <CalendarIcon class="h-3 w-3 mr-1" />
                        <span class="truncate max-w-[200px]"
                            >{event.calendar_id}</span
                        >
                    </div>

                    {#if getOrganizerEmail(event)}
                        {@const email = getOrganizerEmail(event)}
                        <a
                            href={`mailto:${email}`}
                            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded-md hover:bg-accent"
                        >
                            <Mail class="h-3 w-3" />
                            <span>Contact organizer</span>
                        </a>
                    {/if}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    {:else}
        <div
            class="hover-card-container"
            style={hoverCardStyles}
            transition:fade={{ duration: 150 }}
        >
            <Card class="p-4 shadow-lg border rounded-lg">
                <div class="space-y-4">
                    <!-- Header -->
                    <div class="flex items-start gap-2">
                        <div
                            class="w-2 h-8 rounded-sm mt-1 {getEventColor(
                                event,
                            )}"
                        ></div>
                        <h3 class="text-lg font-medium break-words">
                            {event.summary}
                        </h3>
                    </div>

                    <div class="space-y-3">
                        <div class="flex items-start gap-3">
                            <Clock
                                class="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1"
                            />
                            <div class="flex-1">
                                <p class="truncate text-sm">
                                    {getEventTimeDisplay(event)}
                                </p>
                                {#if !(event.is_all_day || event.is_day_event)}
                                    {@const times =
                                        getEventStartEndTimes(event)}
                                    <p class="text-xs text-muted-foreground">
                                        {formatDuration(times.start, times.end)}
                                    </p>
                                {/if}
                            </div>
                        </div>

                        {#if event.location}
                            <div class="flex items-start gap-3">
                                <MapPin
                                    class="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1"
                                />
                                <p class="text-sm truncate flex-1">
                                    {event.location}
                                </p>
                            </div>
                        {/if}

                        {#if event.organizer || event.organizer_email}
                            <div class="flex items-start gap-3">
                                <User
                                    class="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1"
                                />
                                <div class="flex-1">
                                    <p class="text-sm truncate">
                                        {getOrganizerName(event)}
                                    </p>
                                </div>
                            </div>
                        {/if}

                        {#if event.description}
                            <div class="mt-4 border-t pt-3">
                                <div
                                    class={showMore
                                        ? "max-h-[150px] overflow-y-auto"
                                        : "max-h-[80px] overflow-hidden"}
                                >
                                    <p class="text-sm line-clamp-3">
                                        {@html event.description}
                                    </p>
                                </div>
                                {#if event.description.length > 200}
                                    <Button
                                        variant="link"
                                        size="sm"
                                        class="px-0 mt-1"
                                        onclick={() => (showMore = !showMore)}
                                    >
                                        {showMore ? "Show less" : "Show more"}
                                    </Button>
                                {/if}
                            </div>
                        {/if}
                    </div>

                    <div
                        class="flex items-center justify-between pt-2 border-t"
                    >
                        <div
                            class="flex items-center text-xs text-muted-foreground"
                        >
                            <CalendarIcon class="h-3 w-3 mr-1" />
                            <span class="truncate max-w-[150px]"
                                >{event.calendar_id}</span
                            >
                        </div>

                        {#if getOrganizerEmail(event)}
                            {@const email = getOrganizerEmail(event)}
                            <a
                                href={`mailto:${email}`}
                                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded-md hover:bg-accent"
                            >
                                <Mail class="h-3 w-3" />
                                <span>Contact</span>
                            </a>
                        {/if}
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    class="absolute top-2 right-2"
                    onclick={onClose}
                >
                    ×
                </Button>
            </Card>
        </div>
    {/if}
{/if}

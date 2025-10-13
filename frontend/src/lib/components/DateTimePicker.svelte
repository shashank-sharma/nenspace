<!-- src/lib/components/DateTimePicker.svelte -->
<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Calendar } from "$lib/components/ui/calendar";
    import * as Popover from "$lib/components/ui/popover";
    import { ScrollArea } from "$lib/components/ui/scroll-area";
    import { cn } from "$lib/utils";
    import { CalendarDays } from "lucide-svelte";
    import { createEventDispatcher, onMount } from "svelte";
    import type { DateValue } from "@internationalized/date";
    import { getLocalTimeZone, today } from "@internationalized/date";

    let { value = $bindable(), placeholder = "Pick date and time" } = $props<{
        value?: DateValue;
        placeholder?: string;
    }>();

    $effect(() => {
        if (value) {
            console.log("Date time picker value changed", value);
        }
    });

    // Keep a JavaScript Date version for handling time
    let jsDate = $state<Date | undefined>(undefined);

    const dispatch = createEventDispatcher<{
        change: Date;
    }>();

    let isOpen = $state(false);

    // Initialize with the current date and time if no value provided
    onMount(() => {
        if (!value) {
            value = today(getLocalTimeZone());
        }

        // Initialize jsDate with current date AND time
        if (!jsDate) {
            jsDate = new Date();
        } else {
            updateJsDateFromValue();
        }
    });

    // Ensure jsDate updates when value changes and emit a single change
    let prevDateKey = $state<string | null>(null);
    function dateKey(v: DateValue | undefined): string | null {
        if (!v) return null;
        // CalendarDate has year/month/day
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyVal: any = v;
        if ("year" in anyVal && "month" in anyVal && "day" in anyVal) {
            return `${anyVal.year}-${String(anyVal.month).padStart(2, "0")}-${String(anyVal.day).padStart(2, "0")}`;
        }
        return null;
    }

    $effect(() => {
        const key = dateKey(value);
        if (key && key !== prevDateKey) {
            prevDateKey = key;
            updateJsDateFromValue();
            dispatchChangeEvent();
        }
    });

    // Make sure the UI updates when jsDate changes
    const formattedDateTime = $derived(formatDateTime(jsDate));

    // Update jsDate when value changes (no event dispatch here)
    function updateJsDateFromValue() {
        if (!value) return;

        const { year, month, day } = extractDateParts(value);

        // Keep existing time if jsDate exists, otherwise use current time
        if (jsDate) {
            const hours = jsDate.getHours();
            const minutes = jsDate.getMinutes();
            jsDate = new Date(year, month - 1, day, hours, minutes);
        } else {
            // For initial setup, use current time
            const now = new Date();
            jsDate = new Date(
                year,
                month - 1,
                day,
                now.getHours(),
                now.getMinutes(),
            );
        }
    }

    // Extract date parts from a CalendarDate
    function extractDateParts(dateValue: DateValue): {
        year: number;
        month: number;
        day: number;
    } {
        if ("year" in dateValue && "month" in dateValue && "day" in dateValue) {
            return {
                year: dateValue.year,
                month: dateValue.month,
                day: dateValue.day,
            };
        }
        // Fallback to current date if structure is unexpected
        const now = new Date();
        return {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
        };
    }

    function handleTimeChange(type: "hour" | "minute", val: number) {
        // Initialize dates if needed
        if (!value) {
            value = today(getLocalTimeZone());
        }

        if (!jsDate) {
            jsDate = new Date();
        }

        // Create a new Date object to ensure reactivity
        const newDate = new Date(jsDate);

        // Update the time on the new Date object
        if (type === "hour") {
            newDate.setHours(val);
        } else {
            newDate.setMinutes(val);
        }

        // Assign the new Date object to jsDate to trigger reactivity
        jsDate = newDate;

        // Dispatch the change event
        dispatchChangeEvent();
    }

    function dispatchChangeEvent() {
        if (jsDate) {
            dispatch("change", new Date(jsDate));
        }
    }

    // Create arrays for hours and minutes
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

    function formatDateTime(date: Date | undefined): string {
        if (!date) return "";

        try {
            return date.toLocaleString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });
        } catch (error) {
            return "Invalid date/time";
        }
    }
</script>

<Popover.Root bind:open={isOpen}>
    <Popover.Trigger asChild let:builder>
        <Button
            builders={[builder]}
            variant="outline"
            class={cn(
                "w-full justify-start text-left font-normal",
                !value && "text-muted-foreground",
            )}
        >
            <CalendarDays class="mr-2 h-4 w-4" />
            {jsDate ? formattedDateTime : placeholder}
        </Button>
    </Popover.Trigger>
    <Popover.Content class="w-auto p-0">
        <div class="sm:flex">
            <Calendar bind:value initialFocus />
            <div
                class="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x border-l"
            >
                <ScrollArea class="w-64 sm:w-auto" orientation="both">
                    <div class="flex sm:flex-col p-2 gap-1">
                        {#each hours as hour}
                            <Button
                                size="icon"
                                variant={jsDate && jsDate.getHours() === hour
                                    ? "default"
                                    : "ghost"}
                                class="sm:w-full shrink-0 aspect-square"
                                on:click={() => handleTimeChange("hour", hour)}
                            >
                                {hour.toString().padStart(2, "0")}
                            </Button>
                        {/each}
                    </div>
                </ScrollArea>
                <ScrollArea class="w-64 sm:w-auto" orientation="both">
                    <div class="flex sm:flex-col p-2 gap-1">
                        {#each minutes as minute}
                            <Button
                                size="icon"
                                variant={jsDate &&
                                jsDate.getMinutes() === minute
                                    ? "default"
                                    : "ghost"}
                                class="sm:w-full shrink-0 aspect-square"
                                on:click={() =>
                                    handleTimeChange("minute", minute)}
                            >
                                {minute.toString().padStart(2, "0")}
                            </Button>
                        {/each}
                    </div>
                </ScrollArea>
            </div>
        </div>
    </Popover.Content>
</Popover.Root>

<style>
    /* Add some responsive styles to improve sizing within modals */
    :global(.bits-ui-popover-content) {
        max-height: 80vh !important;
        max-width: 90vw !important;
        overflow: auto !important;
    }

    @media (max-width: 640px) {
        :global(.bits-ui-calendar) {
            font-size: 0.875rem !important;
        }

        :global(.bits-ui-calendar-body) {
            max-width: 100% !important;
        }
    }
</style>

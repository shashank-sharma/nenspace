<script lang="ts">
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { toast } from "svelte-sonner";
    import { CalendarService } from "../services/calendar.service";
    import type { Calendar } from "../types/calendar.types";

    let { calendars = $bindable([]), isLoading = false } = $props<{
        calendars?: Calendar[];
        isLoading?: boolean;
    }>();

    async function handleSync() {
        try {
            await CalendarService.triggerSync();
            toast.success("Calendar sync initiated");
        } catch (error) {
            console.error("Error triggering sync:", error);
            toast.error("Failed to trigger calendar sync");
        }
    }
</script>

<Card>
    <CardHeader class="flex flex-row items-center justify-between pb-2">
        <CardTitle class="text-sm font-medium">Calendar Sync</CardTitle>
        <Button
            size="sm"
            variant="ghost"
            on:click={handleSync}
            disabled={isLoading}
        >
            Sync Now
        </Button>
    </CardHeader>
    <CardContent>
        {#if isLoading}
            <div class="text-sm text-muted-foreground">Checking status...</div>
        {:else if calendars.length > 0}
            <div class="space-y-2">
                {#each calendars as calendar}
                    <div class="flex items-center justify-between text-sm">
                        <p class="text-sm font-medium">{calendar.name}</p>
                        <div
                            class:text-green-500={calendar.is_syncing}
                            class:text-gray-500={!calendar.is_syncing}
                        >
                            {calendar.is_syncing ? "Syncing..." : "Idle"}
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div class="text-sm text-muted-foreground">
                No calendars connected.
            </div>
        {/if}
    </CardContent>
</Card>

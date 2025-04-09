<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { fade, slide } from "svelte/transition";
    import { toast } from "svelte-sonner";
    import { calendarStore } from "../stores/calendar.store";
    import {
        Calendar,
        Loader2,
        RefreshCw,
        AlertCircle,
        CheckCircle2,
        Clock,
    } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import {
        Card,
        CardContent,
        CardDescription,
        CardFooter,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import {
        Alert,
        AlertDescription,
        AlertTitle,
    } from "$lib/components/ui/alert";

    export let isLoading = false;

    const componentId = `calendar-sync-${Math.random().toString(36).substring(2, 11)}`;

    let syncing = false;
    let availableTokens: Array<{
        id: string;
        provider: string;
        account: string;
    }> = [];

    $: hasCalendarSync = !!(
        $calendarStore.calendars && $calendarStore.calendars.length > 0
    );
    $: activeCalendar = hasCalendarSync ? $calendarStore.calendars[0] : null;
    $: inProgress = !!activeCalendar?.in_progress;
    $: lastSynced = activeCalendar?.last_synced
        ? new Date(activeCalendar.last_synced)
        : null;
    $: syncStatus = activeCalendar?.sync_status || "";

    async function fetchAvailableTokens() {
        try {
            const tokens = await calendarStore.fetchAvailableTokens();
            availableTokens = tokens as any[];
        } catch (error) {
            console.error("Error fetching tokens:", error);
            toast.error("Failed to fetch available tokens");
        }
    }

    async function triggerSync() {
        if (inProgress) {
            toast.info("Sync is already in progress");
            return;
        }

        try {
            syncing = true;
            await calendarStore.triggerSync();
        } catch (error) {
            console.error("Failed to start calendar sync:", error);
            toast.error("Failed to start calendar sync");
        } finally {
            syncing = false;
        }
    }

    function formatDate(date: Date | null): string {
        if (!date) return "Never";

        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        const timeString = date.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
        });

        if (isToday) {
            return `Today at ${timeString}`;
        } else {
            return `${date.toLocaleDateString([], {
                year: "numeric",
                month: "short",
                day: "numeric",
            })} at ${timeString}`;
        }
    }

    function getSyncStatusColor(status: string | null): string {
        if (!status) return "bg-gray-200 text-gray-700";

        switch (status.toLowerCase()) {
            case "success":
            case "completed":
                return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
            case "error":
            case "failed":
                return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
            case "in_progress":
            case "syncing":
                return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
            default:
                return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
        }
    }

    onMount(async () => {
        await fetchAvailableTokens();
    });
</script>

<div class="max-w-md mx-auto sm:mx-0" id={componentId}>
    {#if isLoading}
        <Card class="border shadow-sm">
            <CardHeader class="pb-2">
                <CardTitle class="flex items-center text-lg">
                    <Calendar class="mr-2 h-4 w-4" />
                    Calendar Sync
                </CardTitle>
            </CardHeader>
            <CardContent class="flex justify-center py-4">
                <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
        </Card>
    {:else if !hasCalendarSync}
        <Card class="border shadow-sm">
            <CardHeader class="pb-2">
                <CardTitle class="flex items-center text-lg">
                    <Calendar class="mr-2 h-4 w-4" />
                    Calendar Sync
                </CardTitle>
                <CardDescription class="text-sm">
                    Add a Google Calendar to see your events
                </CardDescription>
            </CardHeader>
            <CardContent class="py-2">
                <Alert class="mb-3 py-2">
                    <AlertCircle class="h-4 w-4" />
                    <AlertTitle class="text-sm"
                        >No calendar connected</AlertTitle
                    >
                    <AlertDescription class="text-xs">
                        You need to add a calendar before you can view events
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    {:else if activeCalendar}
        <Card class="border shadow-sm">
            <CardHeader class="pb-2">
                <div class="flex justify-between items-center">
                    <CardTitle class="flex items-center text-lg">
                        <Calendar class="mr-2 h-4 w-4" />
                        {activeCalendar.name}
                    </CardTitle>
                    <Badge
                        class={`text-xs py-0.5 ${getSyncStatusColor(syncStatus)}`}
                    >
                        {#if inProgress}
                            <span class="flex items-center">
                                <Loader2 class="h-3 w-3 mr-1 animate-spin" />
                                Syncing
                            </span>
                        {:else if syncStatus}
                            {syncStatus}
                        {:else}
                            Idle
                        {/if}
                    </Badge>
                </div>
                <CardDescription class="text-xs">
                    {#if lastSynced}
                        <div class="flex items-center">
                            <Clock class="h-3 w-3 mr-1 inline" />
                            Last synced: {formatDate(lastSynced)}
                        </div>
                    {:else}
                        <div class="flex items-center">
                            <AlertCircle class="h-3 w-3 mr-1 inline" />
                            Never synced
                        </div>
                    {/if}
                </CardDescription>
            </CardHeader>
            <CardContent class="py-2">
                {#if inProgress}
                    <div
                        class="bg-blue-50 text-blue-800 dark:bg-blue-900 dark:text-blue-200 p-2 text-sm rounded-md flex items-center"
                    >
                        <Loader2 class="h-4 w-4 mr-2 animate-spin" />
                        <span>Syncing calendar events...</span>
                    </div>
                {:else if syncStatus === "error" || syncStatus === "failed"}
                    <div
                        class="bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-200 p-2 text-sm rounded-md flex items-center"
                    >
                        <AlertCircle class="h-4 w-4 mr-2" />
                        <span>Sync failed. Try again.</span>
                    </div>
                {:else if syncStatus === "success" || syncStatus === "completed"}
                    <div
                        class="bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200 p-2 text-sm rounded-md flex items-center"
                    >
                        <CheckCircle2 class="h-4 w-4 mr-2" />
                        <span>Calendar synced successfully</span>
                    </div>
                {/if}
            </CardContent>
            <CardFooter class="flex flex-row gap-2 pt-0 pb-3">
                <Button
                    on:click={triggerSync}
                    disabled={inProgress || syncing}
                    variant="outline"
                    size="sm"
                    class="flex-1"
                >
                    {#if inProgress || syncing}
                        <Loader2 class="mr-2 h-3 w-3 animate-spin" />
                        Syncing...
                    {:else}
                        <RefreshCw class="mr-2 h-3 w-3" />
                        Sync Now
                    {/if}
                </Button>
            </CardFooter>
        </Card>
    {/if}
</div>

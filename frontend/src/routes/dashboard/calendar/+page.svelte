<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import {
        Calendar,
        CalendarSyncStatus,
        UpcomingEvents,
        CalendarAnalytics,
    } from "$lib/features/calendar/components";
    import { calendarStore } from "$lib/features/calendar/stores/calendar.store";
    import { Loader2, RefreshCw, Plus } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { fade } from "svelte/transition";
    import {
        Dialog,
        DialogTrigger,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle,
    } from "$lib/components/ui/dialog";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { toast } from "svelte-sonner";
    import { ensureCalendarData } from "$lib/features/calendar/utils/event.utils";

    let isRefreshing = false;
    let isLoading = true;

    // Variables for Add Calendar dialog
    let showAddCalendarDialog = false;
    let calendarName = "";
    let calendarType = "primary";
    let selectedTokenId = "";
    let availableTokens: Array<{
        id: string;
        provider: string;
        account: string;
    }> = [];
    let isSubmitting = false;

    // Centralized function to fetch all calendar data
    async function fetchCalendarData() {
        console.log("Fetching calendar data");
        isRefreshing = true;
        isLoading = true;

        try {
            // Use the centralized utility function to fetch calendar data
            await ensureCalendarData(true); // Force refresh
        } catch (error) {
            console.error("Failed to fetch calendar data:", error);
        } finally {
            isLoading = false;
            isRefreshing = false;
        }
    }

    $: hasCalendarSync =
        $calendarStore.calendars && $calendarStore.calendars.length > 0;

    // Handle authentication message from popups or redirects
    function handleAuthMessage(event: MessageEvent) {
        if (event.data === "AUTH_COMPLETE") {
            console.log("Auth complete message received");
            fetchCalendarData();
        }
    }

    onMount(() => {
        // Initial data fetch when component mounts - but only if we don't already have data
        if (!$calendarStore.events || $calendarStore.events.length === 0) {
            fetchCalendarData();
        } else {
            isLoading = false;
        }

        // Setup event listener for auth completion or token creation
        window.addEventListener("message", handleAuthMessage);
    });

    onDestroy(() => {
        // Clean up event listener on component destruction
        window.removeEventListener("message", handleAuthMessage);

        // Clean up all subscriptions through the store
        calendarStore.unsubscribeFromAllCalendars();
    });

    // Function to fetch available tokens for calendar connection
    async function fetchAvailableTokens() {
        try {
            const tokens = await calendarStore.fetchAvailableTokens();
            availableTokens = tokens as any[];
        } catch (error) {
            console.error("Error fetching tokens:", error);
            toast.error("Failed to fetch available tokens");
        }
    }

    // Function to submit the add calendar form
    async function submitAddCalendarForm() {
        if (!calendarName) {
            toast.error("Calendar name is required");
            return;
        }

        if (!selectedTokenId) {
            toast.error("Please select a token");
            return;
        }

        isSubmitting = true;
        try {
            const success = await calendarStore.createCalendarToken(
                calendarName,
                calendarType,
                selectedTokenId,
            );

            if (success) {
                toast.success("Calendar added successfully");
                showAddCalendarDialog = false;
                calendarName = "";
                selectedTokenId = "";

                // After successfully adding a calendar, notify the parent to refresh data
                window.postMessage("AUTH_COMPLETE", window.location.origin);
            } else {
                toast.error("Failed to add calendar");
            }
        } catch (error) {
            console.error("Error adding calendar:", error);
            toast.error("Failed to add calendar");
        } finally {
            isSubmitting = false;
        }
    }
</script>

<svelte:head>
    <title>Calendar | Dashboard</title>
</svelte:head>

<div class="container p-4 mx-auto space-y-6">
    <div
        class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
    >
        <div>
            <h1 class="text-3xl font-bold tracking-tight">Calendar</h1>
            <p class="text-muted-foreground">
                Manage and view your calendar events
            </p>
        </div>

        <div class="flex gap-2">
            <Dialog bind:open={showAddCalendarDialog}>
                <DialogTrigger>
                    <Button
                        variant="secondary"
                        size="sm"
                        class="gap-1.5"
                        on:click={fetchAvailableTokens}
                    >
                        <Plus class="h-4 w-4" />
                        Add Calendar
                    </Button>
                </DialogTrigger>

                <DialogContent class="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add Google Calendar</DialogTitle>
                        <DialogDescription>
                            Connect a new Google Calendar to your dashboard
                        </DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-4 py-4">
                        <div class="grid grid-cols-4 items-center gap-4">
                            <Label for="name" class="text-right">Name</Label>
                            <Input
                                id="name"
                                bind:value={calendarName}
                                placeholder="My Calendar"
                                class="col-span-3"
                            />
                        </div>
                        <div class="grid grid-cols-4 items-center gap-4">
                            <Label for="type" class="text-right">Type</Label>
                            <div class="col-span-3">
                                <select
                                    id="type"
                                    class="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    bind:value={calendarType}
                                >
                                    <option value="primary">Primary</option>
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-4 items-center gap-4">
                            <Label for="token" class="text-right">Token</Label>
                            <div class="col-span-3">
                                <select
                                    id="token"
                                    class="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    bind:value={selectedTokenId}
                                >
                                    <option value="" disabled selected
                                        >Select token</option
                                    >
                                    {#if availableTokens.length === 0}
                                        <option value="" disabled
                                            >No tokens available</option
                                        >
                                    {:else}
                                        {#each availableTokens as token}
                                            <option value={token.id}>
                                                {token.account} ({token.provider})
                                            </option>
                                        {/each}
                                    {/if}
                                </select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            on:click={() => (showAddCalendarDialog = false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            on:click={submitAddCalendarForm}
                        >
                            {#if isSubmitting}
                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            {:else}
                                Add Calendar
                            {/if}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Button
                variant="outline"
                size="sm"
                class="gap-1.5"
                on:click={fetchCalendarData}
                disabled={isLoading || isRefreshing}
            >
                <RefreshCw
                    class="h-4 w-4 {isRefreshing ? 'animate-spin' : ''}"
                />
                {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
        </div>
    </div>

    <!-- Calendar layout with CalendarSyncStatus on the right for larger screens -->
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <!-- Main calendar area - appears first on desktop (left side) -->
        <div class="space-y-6 order-2 lg:order-1">
            <!-- Only show calendar if we have syncs available -->
            {#if isLoading}
                <div
                    class="flex items-center justify-center p-12 border rounded-lg"
                >
                    <Loader2
                        class="h-8 w-8 animate-spin text-muted-foreground"
                    />
                </div>
            {:else if hasCalendarSync}
                <!-- Main Calendar Component -->
                <div in:fade={{ duration: 300 }}>
                    <Calendar />
                </div>
            {:else}
                <div
                    class="flex items-center justify-center p-12 border rounded-lg bg-gray-50 dark:bg-gray-900"
                >
                    <div class="text-center">
                        <RefreshCw
                            class="w-12 h-12 mx-auto text-gray-400 mb-4"
                        />
                        <h3 class="text-lg font-medium mb-2">
                            No Calendar Connected
                        </h3>
                        <p class="text-muted-foreground mb-4">
                            Connect a calendar to view and manage your events
                        </p>
                    </div>
                </div>
            {/if}
        </div>

        <!-- Calendar Sync Status Component - appears second on desktop (right side) -->
        <div class="order-1 lg:order-2 space-y-4">
            <CalendarSyncStatus {isLoading} />

            {#if hasCalendarSync && !isLoading}
                <UpcomingEvents
                    events={$calendarStore.events}
                    selectedDate={$calendarStore.selectedDate}
                    view={$calendarStore.view}
                />

                <CalendarAnalytics
                    events={$calendarStore.events}
                    selectedDate={$calendarStore.selectedDate}
                />
            {/if}
        </div>
    </div>
</div>

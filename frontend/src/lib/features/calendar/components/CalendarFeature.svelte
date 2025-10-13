<script lang="ts">
    import {
        Calendar,
        CalendarSyncStatus,
        UpcomingEvents,
        CalendarAnalytics,
    } from "$lib/features/calendar/components";
    import { RefreshCw, Plus } from "lucide-svelte";
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
    import { CalendarService } from "../services";
    import type {
        CalendarEvent,
        CalendarSync,
        CalendarFormData,
    } from "../types";
    import { CALENDAR_TYPES, MAX_CALENDAR_NAME_LENGTH } from "../constants";
    import { withErrorHandling } from "$lib/utils/error-handler.util";
    import {
        validateWithToast,
        required,
        maxLength,
    } from "$lib/utils/validation.util";
    import { useModalState } from "$lib/hooks";
    import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import ButtonControl from "$lib/components/debug/controls/ButtonControl.svelte";
    import SwitchControl from "$lib/components/debug/controls/SwitchControl.svelte";
    import { createPageDebug, DebugSettings } from "$lib/utils/debug-helper";
    import { onMount } from "svelte";

    // Debug settings
    const debugSettings = new DebugSettings("calendarDebugSettings", {
        autoRefresh: false,
        showAnalytics: true,
    });

    let autoRefresh = $state(debugSettings.get("autoRefresh"));
    let showAnalytics = $state(debugSettings.get("showAnalytics"));

    // State Management with Svelte 5 Runes
    let events = $state<CalendarEvent[]>([]);
    let calendars = $state<CalendarSync[]>([]);
    let isLoading = $state(true);
    let isRefreshing = $state(false);
    let view = $state<"month" | "week" | "day">("month");
    let selectedDate = $state(new Date());
    let selectedEvent = $state<CalendarEvent | null>(null);

    const hasCalendarSync = $derived(calendars.length > 0);

    // Modal management using useModalState hook
    const modals = useModalState<CalendarSync>();

    // Form State
    let formData = $state<CalendarFormData>({
        name: "",
        type: "primary",
        tokenId: "",
    });
    let availableTokens = $state<any[]>([]);
    let isSubmitting = $state(false);

    // Data Fetching
    async function fetchCalendarData(forceRefresh = false) {
        if (forceRefresh) {
            isLoading = true;
        }
        isRefreshing = true;

        await withErrorHandling(
            async () => {
                const [fetchedCalendars, fetchedEvents] = await Promise.all([
                    CalendarService.getCalendars(),
                    CalendarService.getEvents(),
                ]);
                calendars = fetchedCalendars;
                events = fetchedEvents.items;
            },
            {
                errorMessage: "Failed to fetch calendar data",
                showToast: true,
            },
        );

        isLoading = false;
        isRefreshing = false;
    }

    async function fetchAvailableTokens() {
        await withErrorHandling(
            async () => {
                availableTokens = await CalendarService.fetchAvailableTokens();
            },
            {
                errorMessage: "Failed to fetch available tokens",
            },
        );
    }

    async function handleAddCalendar() {
        // Validate form
        if (
            !validateWithToast(formData, {
                name: [
                    required("Calendar name is required"),
                    maxLength(
                        MAX_CALENDAR_NAME_LENGTH,
                        `Name must be less than ${MAX_CALENDAR_NAME_LENGTH} characters`,
                    ),
                ],
                tokenId: [required("Please select a token")],
            })
        ) {
            return;
        }

        isSubmitting = true;

        await withErrorHandling(
            () =>
                CalendarService.createCalendarToken(
                    formData.name,
                    formData.type,
                    formData.tokenId,
                ),
            {
                successMessage: "Calendar added successfully",
                errorMessage: "Failed to add calendar",
                onSuccess: async () => {
                    modals.closeAll();
                    // Reset form
                    formData = {
                        name: "",
                        type: "primary",
                        tokenId: "",
                    };
                    await fetchCalendarData(true);
                },
            },
        );

        isSubmitting = false;
    }

    function handleEventClick(event: CalendarEvent) {
        selectedEvent = event;
        // Handle event click logic
    }

    function handleOpenAddDialog() {
        fetchAvailableTokens();
        modals.openCreate();
    }

    // Auto-refresh effect
    let refreshInterval: ReturnType<typeof setInterval> | null = null;
    $effect(() => {
        if (autoRefresh) {
            refreshInterval = setInterval(() => {
                fetchCalendarData(false);
            }, 60000); // 60 seconds
        } else if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }

        return () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
        };
    });

    // Effects and Lifecycle
    onMount(() => {
        fetchCalendarData(true);

        const handleAuthMessage = (event: MessageEvent) => {
            if (event.data === "AUTH_COMPLETE") {
                fetchCalendarData(true);
            }
        };

        window.addEventListener("message", handleAuthMessage);

        // Register debug controls
        const cleanup = createPageDebug(
            "calendar-page-controls",
            "Calendar Options",
        )
            .addButton("refresh-data", "Refresh Data", () =>
                fetchCalendarData(true),
            )
            .addButton("trigger-sync", "Trigger Sync", async () => {
                await withErrorHandling(() => CalendarService.triggerSync(), {
                    successMessage: "Sync triggered",
                    errorMessage: "Failed to trigger sync",
                });
            })
            .addSwitch(
                "auto-refresh",
                "Auto Refresh (60s)",
                autoRefresh,
                (checked) => {
                    autoRefresh = checked;
                    debugSettings.update("autoRefresh", checked);
                },
            )
            .addSwitch(
                "show-analytics",
                "Show Analytics",
                showAnalytics,
                (checked) => {
                    showAnalytics = checked;
                    debugSettings.update("showAnalytics", checked);
                },
            )
            .register({
                ButtonControl: ButtonControl as any,
                SwitchControl: SwitchControl as any,
                SelectControl: null as any,
            });

        return () => {
            cleanup();
            window.removeEventListener("message", handleAuthMessage);
        };
    });
</script>

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
            <Button
                variant="secondary"
                size="sm"
                class="gap-1.5"
                on:click={handleOpenAddDialog}
            >
                <Plus class="h-4 w-4" />
                Add Calendar
            </Button>

            <Dialog bind:open={modals.createModalOpen}>
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
                                bind:value={formData.name}
                                placeholder="My Calendar"
                                class="col-span-3"
                                maxlength={MAX_CALENDAR_NAME_LENGTH}
                            />
                        </div>
                        <div class="grid grid-cols-4 items-center gap-4">
                            <Label for="type" class="text-right">Type</Label>
                            <div class="col-span-3">
                                <select
                                    id="type"
                                    class="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    bind:value={formData.type}
                                >
                                    {#each CALENDAR_TYPES as calendarType}
                                        <option value={calendarType.value}>
                                            {calendarType.label}
                                        </option>
                                    {/each}
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-4 items-center gap-4">
                            <Label for="token" class="text-right">Token</Label>
                            <div class="col-span-3">
                                <select
                                    id="token"
                                    class="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    bind:value={formData.tokenId}
                                >
                                    <option value="" disabled selected>
                                        Select token
                                    </option>
                                    {#if availableTokens.length === 0}
                                        <option value="" disabled>
                                            No tokens available
                                        </option>
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
                            on:click={() => modals.closeAll()}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            on:click={handleAddCalendar}
                        >
                            {#if isSubmitting}
                                <LoadingSpinner size="xs" variant="secondary" />
                                <span class="ml-2">Saving...</span>
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
                on:click={() => fetchCalendarData(true)}
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
            {#if isLoading}
                <LoadingSpinner
                    centered
                    size="lg"
                    label="Loading calendar..."
                />
            {:else if hasCalendarSync}
                <!-- Main Calendar Component -->
                <div in:fade={{ duration: 300 }}>
                    <Calendar
                        bind:view
                        bind:selectedDate
                        {events}
                        on:eventClick={(e) => handleEventClick(e.detail.event)}
                    />
                </div>
            {:else}
                <EmptyState
                    icon={RefreshCw}
                    title="No Calendar Connected"
                    description="Connect a calendar to view and manage your events"
                    actionLabel="Add Calendar"
                    onaction={handleOpenAddDialog}
                />
            {/if}
        </div>

        <!-- Calendar Sync Status Component - appears second on desktop (right side) -->
        <div class="order-1 lg:order-2 space-y-4">
            <CalendarSyncStatus {isLoading} bind:calendars />

            {#if hasCalendarSync && !isLoading}
                <UpcomingEvents {events} {selectedDate} {view} />

                {#if showAnalytics}
                    <CalendarAnalytics {events} bind:selectedDate />
                {/if}
            {/if}
        </div>
    </div>
</div>

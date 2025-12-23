<script lang="ts">
    import {
        Calendar,
        CalendarSyncStatus,
        UpcomingEvents,
        CalendarAnalytics,
        MiniCalendar,
    } from "$lib/features/calendar/components";
    import { RefreshCw, Plus, Calendar as CalendarIcon, CheckCircle2, Settings, Shield, Clock, Loader2, ChevronLeft, ChevronRight } from "lucide-svelte";
    import { Tabs, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    import { format, addDays, addMonths, addWeeks, subMonths, subWeeks } from "date-fns";
    import { Button } from "$lib/components/ui/button";
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";
    import {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue,
    } from "$lib/components/ui/select";
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
    import { validateWithToast, required, maxLength } from "$lib/utils/validation.util";
    import { withErrorHandling } from "$lib/utils/error-handler.util";
    import { useModalState } from "$lib/hooks";
    import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
    import EmptyState from "$lib/components/EmptyState.svelte";
    import ButtonControl from "$lib/components/debug/controls/ButtonControl.svelte";
    import SwitchControl from "$lib/components/debug/controls/SwitchControl.svelte";
    import { createPageDebug, DebugSettings } from "$lib/utils/debug-helper";
    import { onMount } from "svelte";
    import { pb } from "$lib/config/pocketbase";
    import { calendarStore } from "../stores";
    import { toast } from "svelte-sonner";

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
    let view = $state<"month" | "week" | "day">("week");
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
    let inactiveSyncs = $state<CalendarSync[]>([]);
    let selectedCalendarSyncId = $state<string | undefined>(undefined);
    let isLoadingInactiveSyncs = $state(false);
    let hasLoadedInactiveSyncs = $state(false);
    let authWindow: Window | null = null;
    let connectFormData = $state<{ name: string; type: string; tokenId?: string }>({
        name: "",
        type: "primary",
    });
    let isConnecting = $state(false);
    let showConnectForm = $state(false);

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
                
                // Update calendar store with fetched calendars
                calendarStore.calendars = fetchedCalendars;
                calendarStore.events = fetchedEvents.items;
                
                // Update sync status from first active calendar
                if (fetchedCalendars.length > 0) {
                    const activeSync = fetchedCalendars.find(c => c.is_active);
                    if (activeSync) {
                        calendarStore.updateSyncStatus(activeSync);
                    } else {
                        calendarStore.syncStatus = null;
                    }
                } else {
                    calendarStore.syncStatus = null;
                }
            },
            {
                errorMessage: "Failed to fetch calendar data",
                showToast: true,
            },
        );

        isLoading = false;
        isRefreshing = false;
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

    function handleEventClickInList(event: CalendarEvent) {
        if (!event.start) return;
        
        try {
            const eventDate = new Date(event.start);
            if (isNaN(eventDate.getTime())) return;
            
            // Navigate to the event's date
            selectedDate = eventDate;
            
            // Determine appropriate view based on event date
            const today = new Date();
            const daysDiff = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            // If event is today or within current week, use current view
            // Otherwise, switch to month view to see the event in context
            if (Math.abs(daysDiff) > 7) {
                view = "month";
            } else if (Math.abs(daysDiff) > 1) {
                view = "week";
            } else {
                view = "day";
            }
            
            // Also show event details
            handleEventClick(event);
        } catch (error) {
            console.error("Error navigating to event date:", error);
        }
    }

    function formatNavDate(date: Date, view: "month" | "week" | "day"): string {
        if (view === "month") {
            return format(date, "MMMM yyyy");
        } else if (view === "week") {
            return `Week of ${format(date, "MMM d, yyyy")}`;
        } else {
            return format(date, "EEEE, MMMM d, yyyy");
        }
    }

    function goToToday() {
        selectedDate = new Date();
    }

    function navigatePrevious() {
        if (view === "month") {
            selectedDate = subMonths(selectedDate, 1);
        } else if (view === "week") {
            selectedDate = subWeeks(selectedDate, 1);
        } else {
            selectedDate = addDays(selectedDate, -1);
        }
    }

    function navigateNext() {
        if (view === "month") {
            selectedDate = addMonths(selectedDate, 1);
        } else if (view === "week") {
            selectedDate = addWeeks(selectedDate, 1);
        } else {
            selectedDate = addDays(selectedDate, 1);
        }
    }

    // Sort events by start date
    const sortedEvents = $derived(
        [...events].sort(
            (a, b) => {
                if (!a.start || !b.start) return 0;
                return new Date(a.start).getTime() - new Date(b.start).getTime();
            }
        )
    );

    function formatEventDate(event: CalendarEvent): string {
        if (!event.start) return "No date";
        try {
            const date = new Date(event.start);
            if (isNaN(date.getTime())) return "Invalid date";
            
            if (event.is_all_day || event.is_day_event) {
                return format(date, "EEE, MMM d, yyyy");
            }
            return format(date, "EEE, MMM d, yyyy 'at' h:mm a");
        } catch {
            return "Invalid date";
        }
    }

    function handleOpenAddDialog() {
        fetchAvailableTokens();
        modals.openCreate();
    }

    async function fetchAvailableTokens() {
        try {
            availableTokens = await CalendarService.fetchAvailableTokens();
        } catch (error) {
            console.error("Failed to fetch available tokens:", error);
            availableTokens = [];
        }
    }

    async function handleConnectCalendar() {
        // Validate form data
        if (!validateWithToast(
            () => required(connectFormData.name, "Calendar name is required"),
            () => maxLength(connectFormData.name, MAX_CALENDAR_NAME_LENGTH, `Name must be ${MAX_CALENDAR_NAME_LENGTH} characters or less`)
        )) {
            return;
        }

        // If token is selected, create sync directly
        if (connectFormData.tokenId) {
            try {
                isConnecting = true;
                await CalendarService.createCalendarToken(
                    connectFormData.name,
                    connectFormData.type,
                    connectFormData.tokenId
                );
                toast.success("Calendar connected successfully");
                await fetchCalendarData(true);
                connectFormData = { name: "", type: "primary" };
                showConnectForm = false;
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to connect calendar");
            } finally {
                isConnecting = false;
            }
            return;
        }

        // Otherwise, start OAuth flow
        try {
            isConnecting = true;
            // Store name and type in sessionStorage for after OAuth
            sessionStorage.setItem('calendar_connect_name', connectFormData.name);
            sessionStorage.setItem('calendar_connect_type', connectFormData.type);
            if (selectedCalendarSyncId) {
                sessionStorage.setItem('calendar_sync_id', selectedCalendarSyncId);
            }

            const url = await CalendarService.startAuth();
            if (url) {
                authWindow = window.open(
                    url,
                    'auth',
                    'width=600,height=800'
                );
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to start authentication');
            isConnecting = false;
        }
    }

    async function handleAuthComplete(tokenId?: string) {
        // Get stored name and type from sessionStorage
        const storedName = sessionStorage.getItem('calendar_connect_name');
        const storedType = sessionStorage.getItem('calendar_connect_type');
        const storedSyncId = sessionStorage.getItem('calendar_sync_id');

        // Clean up sessionStorage
        sessionStorage.removeItem('calendar_connect_name');
        sessionStorage.removeItem('calendar_connect_type');
        if (storedSyncId) {
            sessionStorage.removeItem('calendar_sync_id');
        }

        // If we have a token ID from OAuth callback, create calendar sync
        if (tokenId && storedName && storedType) {
            try {
                await CalendarService.createCalendarToken(
                    storedName,
                    storedType,
                    tokenId
                );
                toast.success("Calendar connected successfully");
                await fetchCalendarData(true);
                connectFormData = { name: "", type: "primary" };
                showConnectForm = false;
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to create calendar sync");
            }
        } else if (storedName && storedType) {
            // If we don't have tokenId, try to get it from the callback response
            // This will be handled by the OAuth callback page
            await fetchCalendarData(true);
        }
        
        isConnecting = false;
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

    // Subscribe to calendar sync status changes - realtime updates
    let unsubscribeSync: (() => void) | null = null;
    $effect(() => {
        const syncId = calendarStore.syncStatus?.id;
        if (!syncId) {
            if (unsubscribeSync) {
                unsubscribeSync();
                unsubscribeSync = null;
            }
            return;
        }

        // Only subscribe if we don't already have a subscription
        if (unsubscribeSync) return;

        pb.collection("calendar_sync")
            .subscribe(
                syncId,
                (e: { record: CalendarSync }) => {
                    const previousStatus = calendarStore.syncStatus?.sync_status;
                    calendarStore.updateSyncStatus(e.record);
                    
                    // Show toast for errors
                    const currentStatus = calendarStore.syncStatus;
                    if (currentStatus?.sync_status === "failed") {
                        toast.error("Calendar sync failed", {
                            duration: 10000,
                        });
                    }
                    
                    // Show toast for inactive status requiring re-authentication
                    if (!currentStatus?.is_active || currentStatus?.sync_status === "inactive") {
                        toast.warning("Calendar sync is inactive. Please re-authenticate to continue syncing.", {
                            duration: 10000,
                        });
                    }
                    
                    // Show success toast when sync completes
                    if (e.record.sync_status === "added" || e.record.sync_status === "success") {
                        if (previousStatus === "syncing" || previousStatus === "in_progress") {
                            toast.success("Calendar sync completed successfully");
                            // Refresh events after successful sync
                            fetchCalendarData(false);
                        }
                    }
                }
            )
            .then((unsub) => {
                unsubscribeSync = unsub;
            })
            .catch((error) => {
                console.error("Failed to subscribe to calendar sync:", error);
                toast.error("Failed to connect to realtime updates");
            });

        return () => {
            if (unsubscribeSync) {
                unsubscribeSync();
                unsubscribeSync = null;
            }
        };
    });

    // Subscribe to calendar events changes - realtime updates
    let unsubscribeEvents: (() => void) | null = null;
    $effect(() => {
        // Only subscribe if user has calendars
        const hasCalendars = calendarStore.hasCalendars;
        const userId = pb.authStore.model?.id;
        
        if (!hasCalendars || !userId) {
            // Clean up subscription if calendars are removed or user logs out
            if (unsubscribeEvents) {
                unsubscribeEvents();
                unsubscribeEvents = null;
            }
            return;
        }

        // Only subscribe once (don't resubscribe if already subscribed)
        if (unsubscribeEvents) return;

        pb.collection("calendar_events")
            .subscribe("*", (e: { action: string; record: CalendarEvent }) => {
                // Filter events by current user
                if (e.record.user !== userId) {
                    return; // Skip events not belonging to current user
                }

                // Also check if event belongs to one of user's calendars
                const belongsToUserCalendar = calendarStore.calendars.some(
                    (cal) => cal.id === e.record.calendar
                );
                if (!belongsToUserCalendar) {
                    return; // Skip events from calendars not owned by user
                }

                if (e.action === "create") {
                    calendarStore.upsertEvent(e.record);
                    // Also update local events array
                    const index = events.findIndex((ev) => ev.id === e.record.id);
                    if (index >= 0) {
                        events[index] = e.record;
                    } else {
                        // Insert in sorted order by start date
                        const eventStart = new Date(e.record.start).getTime();
                        const insertIndex = events.findIndex(
                            (ev) => new Date(ev.start).getTime() > eventStart
                        );
                        if (insertIndex === -1) {
                            events = [...events, e.record];
                        } else {
                            events = [
                                ...events.slice(0, insertIndex),
                                e.record,
                                ...events.slice(insertIndex)
                            ];
                        }
                    }
                } else if (e.action === "update") {
                    calendarStore.upsertEvent(e.record);
                    // Also update local events array
                    const index = events.findIndex((ev) => ev.id === e.record.id);
                    if (index >= 0) {
                        events[index] = e.record;
                    }
                } else if (e.action === "delete") {
                    calendarStore.removeEvent(e.record.id);
                    // Also remove from local events array
                    events = events.filter((ev) => ev.id !== e.record.id);
                }
            })
            .then((unsub) => {
                unsubscribeEvents = unsub;
            })
            .catch((error) => {
                console.error("Failed to subscribe to calendar events:", error);
                toast.error("Failed to connect to realtime event updates");
            });

        return () => {
            if (unsubscribeEvents) {
                unsubscribeEvents();
                unsubscribeEvents = null;
            }
        };
    });

    // Effects and Lifecycle
    onMount(() => {
        fetchCalendarData(true);
        // fetchCalendarData already updates sync status from fetched calendars
        // The subscription will handle real-time updates, so no need for separate checkStatus call

        const handleAuthMessage = (event: MessageEvent) => {
            if (event.data === "AUTH_COMPLETE" || (event.data?.type === "AUTH_COMPLETE")) {
                const tokenId = event.data?.tokenId || undefined;
                handleAuthComplete(tokenId);
                if (authWindow) {
                    authWindow.close();
                    authWindow = null;
                }
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

<div class="calendar-floating-layout">
    <!-- Top: Header and Actions -->
    <div class="calendar-top-card">
    <div
        class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
    >
        <div>
                <h1 class="text-3xl font-bold tracking-tight">
                    {#if hasCalendarSync && !isLoading}
                        {formatNavDate(selectedDate, view)}
                    {:else}
                        Calendar
                    {/if}
                </h1>
        </div>

            <div class="flex gap-2 items-center">
                {#if hasCalendarSync && !isLoading}
                    <!-- Calendar Navigation Controls -->
                    <div class="flex gap-2 flex-wrap items-center">
                        <div class="flex gap-1">
                            <Button
                                size="sm"
                                variant="outline"
                                on:click={goToToday}
                            >
                                Today
                            </Button>
                            <div class="flex">
                                <Button
                                    size="icon"
                                    class="h-9 w-9 rounded-r-none border-r"
                                    on:click={navigatePrevious}
                                >
                                    <ChevronLeft class="h-4 w-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    class="h-9 w-9 rounded-l-none"
                                    on:click={navigateNext}
                                >
                                    <ChevronRight class="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <Tabs value={view} class="w-[250px]">
                            <TabsList class="grid w-full grid-cols-3">
                                <TabsTrigger
                                    value="month"
                                    on:click={() => view = "month"}
                                >Month</TabsTrigger>
                                <TabsTrigger
                                    value="week"
                                    on:click={() => view = "week"}
                                >Week</TabsTrigger>
                                <TabsTrigger
                                    value="day"
                                    on:click={() => view = "day"}
                                >Day</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                {/if}
                
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
    </div>

    <!-- Main Content Area -->
    <div class="calendar-content-area">
            {#if isLoading}
            <div class="flex items-center justify-center h-full">
                <LoadingSpinner
                    centered
                    size="lg"
                    label="Loading calendar..."
                />
            </div>
        {:else if !hasCalendarSync}
            <!-- Empty State - No Calendar Connected -->
            <div class="flex flex-col items-center justify-center h-full p-8 gap-8 max-w-5xl mx-auto overflow-auto">
            <!-- Main Connect Card -->
            <Card class="w-full">
                <CardHeader class="text-center">
                    <div class="flex justify-center mb-4">
                        <div class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                            <CalendarIcon class="w-10 h-10 text-primary" />
                        </div>
                    </div>
                    <CardTitle class="text-3xl">Connect Your Calendar</CardTitle>
                    <CardDescription class="text-base mt-2">
                        Securely connect your Google Calendar to start managing your events
                    </CardDescription>
                </CardHeader>
                <CardContent class="flex flex-col gap-4 pt-6">
                    <div class="space-y-4">
                        <!-- Calendar Name -->
                        <div class="space-y-2">
                            <Label for="connect-name">Calendar Name</Label>
                            <Input
                                id="connect-name"
                                bind:value={connectFormData.name}
                                placeholder="My Calendar"
                                maxlength={MAX_CALENDAR_NAME_LENGTH}
                            />
                        </div>

                        <!-- Calendar Type -->
                        <div class="space-y-2">
                            <Label for="connect-type">Calendar Type</Label>
                            <select
                                id="connect-type"
                                class="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                bind:value={connectFormData.type}
                            >
                                {#each CALENDAR_TYPES as calendarType}
                                    <option value={calendarType.value}>
                                        {calendarType.label}
                                    </option>
                                {/each}
                            </select>
                        </div>

                        <!-- Token Selection: Use existing or create new -->
                        <div class="space-y-2">
                            <Label for="connect-token">Authentication</Label>
                            <Select
                                value={connectFormData.tokenId || "new"}
                                onValueChange={(value) => {
                                    connectFormData.tokenId = value === "new" ? undefined : value;
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select authentication method" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">Create new Google Calendar connection</SelectItem>
                                    {#if availableTokens.length > 0}
                                        <div class="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                            Use existing token
                                        </div>
                                        {#each availableTokens as token}
                                            <SelectItem value={token.id}>
                                                {token.account} (Google Calendar)
                                            </SelectItem>
                                        {/each}
                                    {/if}
                                </SelectContent>
                            </Select>
                            {#if connectFormData.tokenId}
                                <p class="text-xs text-muted-foreground">
                                    Using existing authentication token
                                </p>
                            {:else}
                                <p class="text-xs text-muted-foreground">
                                    You'll be redirected to Google to authorize access
                                </p>
                            {/if}
                        </div>

                        {#if inactiveSyncs.length > 0}
                            <div class="space-y-2">
                                <label class="text-sm font-medium">Re-authenticate existing calendar (optional)</label>
                                <Select
                                    value={selectedCalendarSyncId}
                                    onValueChange={(value) => {
                                        selectedCalendarSyncId = value === "new" ? undefined : value;
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select an inactive calendar or create new" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="new">Create new connection</SelectItem>
                                        {#each inactiveSyncs as sync}
                                            <SelectItem value={sync.id}>
                                                {sync.name} - Last synced: {sync.last_synced ? new Date(sync.last_synced).toLocaleDateString() : 'Never'}
                                            </SelectItem>
                                        {/each}
                                    </SelectContent>
                                </Select>
                                {#if selectedCalendarSyncId}
                                    <p class="text-xs text-muted-foreground">
                                        This will update the existing calendar with a new token
                                    </p>
                                {/if}
                            </div>
                        {/if}

                        <div class="flex justify-center pt-2">
                            <Button 
                                size="lg" 
                                class="px-8"
                                on:click={handleConnectCalendar}
                                disabled={isConnecting}
                            >
                                {#if isConnecting}
                                    <Loader2 class="mr-2 h-5 w-5 animate-spin" />
                                    {connectFormData.tokenId ? "Connecting..." : "Authenticating..."}
                                {:else}
                                    <CalendarIcon class="mr-2 h-5 w-5" />
                                    {connectFormData.tokenId ? "Connect Calendar" : "Connect Google Calendar"}
                                {/if}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- 3-Step Progression -->
            <div class="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Step 1: Authorize -->
                <Card>
                    <CardHeader>
                        <div class="flex items-center gap-3 mb-2">
                            <Shield class="h-6 w-6 text-primary" />
                            <CardTitle class="text-lg">Authorize Calendar</CardTitle>
                        </div>
                        <CardDescription>
                            Securely authorize access to your Google Calendar with OAuth 2.0.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul class="space-y-2 text-sm text-muted-foreground">
                            <li class="flex items-start gap-2">
                                <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <span>OAuth 2.0 secure authentication</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <span>No password storage</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <span>Google-managed security</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                <!-- Step 2: Sync Configuration -->
                <Card>
                    <CardHeader>
                        <div class="flex items-center gap-3 mb-2">
                            <Settings class="h-6 w-6 text-primary" />
                            <CardTitle class="text-lg">Sync Configuration</CardTitle>
                        </div>
                        <CardDescription>
                            Automatically sync your events and keep your calendar up to date.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul class="space-y-2 text-sm text-muted-foreground">
                            <li class="flex items-start gap-2">
                                <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <span>Automatic event synchronization</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <span>Real-time updates</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <span>6 months of history</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                <!-- Step 3: Take Control -->
                <Card>
                    <CardHeader>
                        <div class="flex items-center gap-3 mb-2">
                            <Clock class="h-6 w-6 text-primary" />
                            <CardTitle class="text-lg">Manage Events</CardTitle>
                        </div>
                        <CardDescription>
                            View, organize, and manage your calendar events in one place.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul class="space-y-2 text-sm text-muted-foreground">
                            <li class="flex items-start gap-2">
                                <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <span>Multiple calendar views</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <span>Event analytics and insights</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <CheckCircle2 class="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <span>Upcoming events preview</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    {:else}
        <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr_500px] gap-6">
                <!-- Mini Calendar Navigation - Left Sidebar -->
                <div class="order-1 lg:order-1 flex flex-col gap-4">
                    {#if hasCalendarSync && !isLoading}
                        <MiniCalendar bind:selectedDate {events} />
                        
                        <!-- All Events List Card -->
                        <Card class="flex-1 min-h-0 flex flex-col">
                            <CardHeader class="flex-shrink-0">
                                <CardTitle class="text-lg">All Events</CardTitle>
                            </CardHeader>
                            <CardContent class="flex-1 min-h-0 overflow-auto">
                                {#if events.length === 0}
                                    <p class="text-sm text-muted-foreground text-center py-4">
                                        No events found
                                    </p>
                                {:else}
                                    <div class="space-y-2">
                                        {#each sortedEvents as event}
                                            <div
                                                class="p-2 border rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                                onclick={() => handleEventClickInList(event)}
                                                role="button"
                                                tabindex="0"
                                                onkeydown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        handleEventClickInList(event);
                                                    }
                                                }}
                                            >
                                                <div class="flex justify-between items-start gap-2">
                                                    <div class="flex-1 min-w-0">
                                                        <div class="font-medium text-sm truncate">
                                                            {event.summary || 'Untitled Event'}
                                                        </div>
                                                        <div class="text-xs text-muted-foreground mt-1">
                                                            {formatEventDate(event)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            </CardContent>
                        </Card>
                    {/if}
                </div>

                <!-- Main calendar area - appears second on desktop (middle) -->
                <div class="calendar-main-view order-2 lg:order-2">
                <!-- Main Calendar Component -->
                    <div class="calendar-wrapper" in:fade={{ duration: 300 }}>
                    <Calendar
                        bind:view
                        bind:selectedDate
                        {events}
                        on:eventClick={(e) => handleEventClick(e.detail.event)}
                    />
                </div>
        </div>

                <!-- Sidebar with upcoming events and analytics -->
                <div class="calendar-sidebar order-3 lg:order-3">
            {#if hasCalendarSync && !isLoading}
                        <div class="h-full flex flex-col space-y-4 pb-4">
                            <div class="flex-shrink-0">
                <UpcomingEvents {events} {selectedDate} {view} />
                            </div>

                {#if showAnalytics}
                                <div class="flex-1 min-h-0">
                    <CalendarAnalytics {events} bind:selectedDate />
                                </div>
                            {/if}
                        </div>
                {/if}
                </div>
            </div>
            {/if}
        </div>

    <!-- Bottom: Status Bar -->
    <div class="calendar-bottom-card">
        <CalendarSyncStatus />
    </div>
</div>

<style>
    .calendar-floating-layout {
        display: flex;
        flex-direction: column;
        height: 100%;
        gap: 1rem;
        padding: 1rem;
        overflow: hidden;
    }

    .calendar-top-card {
        flex-shrink: 0;
        z-index: 10;
    }

    .calendar-content-area {
        flex: 1;
        min-height: 0;
        overflow: hidden; /* Prevent page scroll */
        display: flex;
        flex-direction: column;
        margin-bottom: 1rem; /* Space before bottom card */
    }
    
    .calendar-content-area .grid {
        flex: 1;
        min-height: 0;
        display: grid;
        overflow: hidden;
    }
    
    .calendar-content-area .grid > div {
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    
    .calendar-main-view {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    
    .calendar-wrapper {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    
    .calendar-sidebar {
        flex: 1;
        min-height: 0;
        overflow: hidden; /* Don't scroll sidebar, let cards scroll internally */
        display: flex;
        flex-direction: column;
    }
    
    .calendar-sidebar > div {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    
    /* Custom scrollbar styles are now global in app.css */

    .calendar-bottom-card {
        flex-shrink: 0;
        z-index: 10;
    }

    @media (max-width: 1024px) {
        .calendar-content-area .grid {
            grid-template-columns: 1fr;
        }
        
        .calendar-content-area .grid > div {
            order: initial;
        }
    }
</style>

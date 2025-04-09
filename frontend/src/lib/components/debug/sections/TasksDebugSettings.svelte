<script lang="ts">
    import { browser } from "$app/environment";
    import { writable } from "svelte/store";
    import { slide } from "svelte/transition";
    import { Switch } from "$lib/components/ui/switch";
    import { Button } from "$lib/components/ui/button";
    import { CheckSquare, PlusCircle } from "lucide-svelte";

    // Create store for task debug settings
    const STORAGE_KEY = "tasksDebugSettings";
    const tasksDebugSettings = writable<{
        showCompleted: boolean;
        enableDragAndDrop: boolean;
        showTaskTimers: boolean;
    }>(
        browser
            ? JSON.parse(
                  localStorage.getItem(STORAGE_KEY) ||
                      JSON.stringify({
                          showCompleted: true,
                          enableDragAndDrop: true,
                          showTaskTimers: false,
                      }),
              )
            : {
                  showCompleted: true,
                  enableDragAndDrop: true,
                  showTaskTimers: false,
              },
    );

    // Debug enabled flag
    const DEBUG_ENABLED_KEY = "debugTasksEnabled";
    const isDebugEnabled = writable<boolean>(
        browser ? localStorage.getItem(DEBUG_ENABLED_KEY) === "true" : false,
    );

    // Save settings to localStorage when they change
    tasksDebugSettings.subscribe((value) => {
        if (browser) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(value));

            // You could also dispatch an event or update a global store here
            // to notify other components of the change
        }
    });

    // Save debug enabled state to localStorage
    isDebugEnabled.subscribe((value) => {
        if (browser) {
            localStorage.setItem(DEBUG_ENABLED_KEY, value.toString());

            // If debug is disabled, reset to default settings
            if (!value) {
                tasksDebugSettings.set({
                    showCompleted: true,
                    enableDragAndDrop: true,
                    showTaskTimers: false,
                });
            }
        }
    });

    // Update a specific setting
    function updateSetting(
        key: keyof typeof $tasksDebugSettings,
        value: boolean,
    ) {
        tasksDebugSettings.update((settings) => ({
            ...settings,
            [key]: value,
        }));
    }
</script>

<div class="space-y-4">
    <div class="flex items-center justify-between">
        <label for="tasks-debug-toggle" class="flex items-center text-sm gap-2">
            <CheckSquare size={16} class="text-indigo-400" />
            <span>Enable Tasks Debug Mode</span>
        </label>
        <Switch
            id="tasks-debug-toggle"
            checked={$isDebugEnabled}
            onCheckedChange={(checked) => {
                $isDebugEnabled = checked;
            }}
        />
    </div>

    {#if $isDebugEnabled}
        <div
            class="pt-2 border-t border-muted"
            transition:slide={{ duration: 150 }}
        >
            <div class="mb-2 text-sm text-muted-foreground">
                Task Display Options
            </div>

            <div class="space-y-3">
                <!-- Show Completed Tasks -->
                <div class="flex items-center justify-between">
                    <label for="show-completed-toggle" class="text-sm">
                        Show completed tasks
                    </label>
                    <Switch
                        id="show-completed-toggle"
                        checked={$tasksDebugSettings.showCompleted}
                        onCheckedChange={(checked) => {
                            updateSetting("showCompleted", checked);
                        }}
                    />
                </div>

                <!-- Enable Drag and Drop -->
                <div class="flex items-center justify-between">
                    <label for="drag-drop-toggle" class="text-sm">
                        Enable drag & drop
                    </label>
                    <Switch
                        id="drag-drop-toggle"
                        checked={$tasksDebugSettings.enableDragAndDrop}
                        onCheckedChange={(checked) => {
                            updateSetting("enableDragAndDrop", checked);
                        }}
                    />
                </div>

                <!-- Show Task Timers -->
                <div class="flex items-center justify-between">
                    <label for="task-timers-toggle" class="text-sm">
                        Show task timers
                    </label>
                    <Switch
                        id="task-timers-toggle"
                        checked={$tasksDebugSettings.showTaskTimers}
                        onCheckedChange={(checked) => {
                            updateSetting("showTaskTimers", checked);
                        }}
                    />
                </div>
            </div>
        </div>
    {/if}
</div>

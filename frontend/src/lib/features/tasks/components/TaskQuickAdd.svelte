<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { fly } from "svelte/transition";
    import { Input } from "$lib/components/ui/input";
    import { Button } from "$lib/components/ui/button";
    import { tasksStore } from "../stores/tasks.store";

    export let category: string;

    const dispatch = createEventDispatcher();
    let newTaskTitle = "";

    async function handleSubmit() {
        if (!newTaskTitle.trim()) return;

        try {
            await tasksStore.createTask({
                title: newTaskTitle.trim(),
                description: "",
                category,
            });
            dispatch("close");
        } catch (error) {
            console.error("Failed to create task:", error);
        }
    }
</script>

<div
    class="bg-card border rounded-lg p-3 mb-3 shadow-sm"
    in:fly={{ y: -20, duration: 200 }}
>
    <Input
        placeholder="Enter task title..."
        bind:value={newTaskTitle}
        class="mb-2"
        on:keydown={(e) => e.key === "Enter" && handleSubmit()}
    />
    <div class="flex justify-end gap-2">
        <Button variant="ghost" size="sm" on:click={() => dispatch("close")}>
            Cancel
        </Button>
        <Button size="sm" on:click={handleSubmit}>Add</Button>
    </div>
</div>

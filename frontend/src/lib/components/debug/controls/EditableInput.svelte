<script lang="ts">
    import { writable, type Writable } from "svelte/store";
    import { Input } from "$lib/components/ui/input";
    import { Check, X } from "lucide-svelte";
    import { cn } from "$lib/utils.js";

    // Props
    export let store: Writable<string>;
    export let placeholder: string = "";
    export let className: string = "";

    // Local state
    let editValue: string;
    let isEditing = false;

    // Initialize edit value from store
    $: if (!isEditing) {
        editValue = $store;
    }

    // Start editing
    function startEdit() {
        editValue = $store;
        isEditing = true;
    }

    // Save changes
    function saveChanges() {
        store.set(editValue);
        isEditing = false;
    }

    // Cancel editing
    function cancelEdit() {
        editValue = $store;
        isEditing = false;
    }

    // Handle Enter and Escape keys
    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            saveChanges();
        } else if (e.key === "Escape") {
            cancelEdit();
        }
    }
</script>

<div class="relative flex w-full">
    {#if isEditing}
        <Input
            bind:value={editValue}
            {placeholder}
            class={cn("pr-16", className)}
            on:keydown={handleKeydown}
            on:focus={() => (isEditing = true)}
        />
        <div class="absolute right-0 inset-y-0 flex items-center pr-1">
            <button
                type="button"
                class="p-1 hover:bg-green-500/20 text-green-500 rounded-sm mr-1"
                on:click={saveChanges}
                title="Save"
            >
                <Check size={14} />
            </button>
            <button
                type="button"
                class="p-1 hover:bg-red-500/20 text-red-500 rounded-sm"
                on:click={cancelEdit}
                title="Cancel"
            >
                <X size={14} />
            </button>
        </div>
    {:else}
        <Input
            value={$store}
            {placeholder}
            class={cn("cursor-pointer hover:border-primary/50", className)}
            on:focus={startEdit}
            on:click={startEdit}
            readonly
        />
    {/if}
</div>

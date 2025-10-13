<script lang="ts">
    import { writable, type Writable } from "svelte/store";
    import { Input } from "$lib/components/ui/input";
    import { Check, X } from "lucide-svelte";
    import { cn } from "$lib/utils";

    let {
        value,
        placeholder = "",
        className = "",
        id = "",
        onChange = () => {},
    } = $props<{
        value: string;
        placeholder?: string;
        className?: string;
        id?: string;
        onChange?: (value: string) => void;
    }>();

    // Local state
    let isEditing = $state(false);
    let editValue = $state(value);

    // Start editing
    function startEdit() {
        editValue = value;
        isEditing = true;
    }

    // Save changes
    function saveChanges() {
        onChange(editValue);
        isEditing = false;
    }

    // Cancel editing
    function cancelEdit() {
        editValue = value;
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
            {id}
            bind:value={editValue}
            {placeholder}
            class={cn("pr-16", className)}
            onkeydown={handleKeydown}
            onfocus={() => (isEditing = true)}
        />
        <div class="absolute right-0 inset-y-0 flex items-center pr-1">
            <button
                type="button"
                class="p-1 hover:bg-green-500/20 text-green-500 rounded-sm mr-1"
                onclick={saveChanges}
                title="Save"
            >
                <Check size={14} />
            </button>
            <button
                type="button"
                class="p-1 hover:bg-red-500/20 text-red-500 rounded-sm"
                onclick={cancelEdit}
                title="Cancel"
            >
                <X size={14} />
            </button>
        </div>
    {:else}
        <Input
            {id}
            {value}
            {placeholder}
            class={cn("cursor-pointer hover:border-primary/50", className)}
            onfocus={startEdit}
            onclick={startEdit}
            readonly
        />
    {/if}
</div>

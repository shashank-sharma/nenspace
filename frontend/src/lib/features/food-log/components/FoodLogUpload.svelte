<script lang="ts">
    import { FOOD_TAGS, DEFAULT_FOOD_LOG_FORM } from "../types";
    import type { FoodLogFormData, FoodLogEntry } from "../types";
    import {
        MAX_IMAGE_SIZE_BYTES,
        MAX_IMAGE_SIZE_MB,
        ALLOWED_IMAGE_TYPES,
    } from "../constants";
    import { onMount } from "svelte";
    import {
        getLocalTimeZone,
        today,
        parseDate,
    } from "@internationalized/date";
    import type { DateValue } from "@internationalized/date";
    import { Button } from "$lib/components/ui/button";
    import { Label } from "$lib/components/ui/label";
    import { Input } from "$lib/components/ui/input";
    import { toast } from "svelte-sonner";
    import { X, Upload } from "lucide-svelte";
    import DateTimePicker from "$lib/components/DateTimePicker.svelte";
    import { createEventDispatcher } from "svelte";
    import { required, validateWithToast } from "$lib/utils";

    let {
        initialTag = null,
        compact = false,
        editEntry = null,
        mode = "create",
    } = $props<{
        initialTag?: string | null | undefined;
        compact?: boolean;
        editEntry?: FoodLogEntry | null;
        mode?: "create" | "edit";
    }>();

    const dispatch = createEventDispatcher<{
        submit: FoodLogFormData & { id?: string };
    }>();

    let formData = $state<FoodLogFormData>({ ...DEFAULT_FOOD_LOG_FORM });
    let fileInput: HTMLInputElement;
    let isDragging = $state(false);
    let isSubmitting = $state(false);
    let dropZone: HTMLDivElement;

    // DateValue for the DateTimePicker
    let datePickerValue = $state<DateValue>(today(getLocalTimeZone()));

    // JavaScript Date for our form data
    let dateValue = $state<Date>(new Date());

    // Create a string value for the select component
    let selectedTag = $state(initialTag || DEFAULT_FOOD_LOG_FORM.tag);

    // Keep tag in sync if the parent updates initialTag
    $effect(() => {
        if (initialTag && initialTag !== formData.tag) {
            selectedTag = initialTag;
            formData.tag = initialTag;
        }
    });

    let previewUrl = $state<string | null>(null);

    $effect(() => {
        if (formData.image) {
            const url = URL.createObjectURL(formData.image);
            previewUrl = url;
            return () => {
                URL.revokeObjectURL(url);
                previewUrl = null;
            };
        } else {
            previewUrl = null;
        }
    });

    // Initial setup to ensure the date field in formData is set to ISO string
    onMount(() => {
        // If editing, populate form with existing data
        if (mode === "edit" && editEntry) {
            formData.name = editEntry.name;
            formData.tag = editEntry.tag;
            formData.date = editEntry.date;
            selectedTag = editEntry.tag;

            // Set date picker value
            const entryDate = new Date(editEntry.date);
            dateValue = entryDate;

            // Parse date for DateTimePicker
            const dateStr = entryDate.toISOString().split("T")[0];
            datePickerValue = parseDate(dateStr);

            // Note: We don't set the image as File, but we could show existing image
        } else {
            // Initialize with the current date/time for create mode
            formData.date = dateValue.toISOString();

            // Set initial tag if provided
            if (initialTag) {
                selectedTag = initialTag;
                formData.tag = initialTag;
            }
        }
    });

    // Handle date change from the DateTimePicker
    function handleDateChange(date: Date) {
        if (date instanceof Date && !isNaN(date.getTime())) {
            dateValue = date;
            formData.date = dateValue.toISOString();
        } else {
            console.warn("Invalid date received from DateTimePicker:", date);
        }
    }

    // Reset form after submission
    function resetForm() {
        formData = { ...DEFAULT_FOOD_LOG_FORM };
        dateValue = new Date(); // Reset to current date/time
        datePickerValue = today(getLocalTimeZone()); // Reset DatePicker value
        formData.date = dateValue.toISOString();
        selectedTag = initialTag || formData.tag;
        formData.tag = selectedTag;
        previewUrl = null;
        if (fileInput) fileInput.value = "";
    }

    // Handle file selection
    function handleFileSelect(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        handleFile(input.files[0]);
    }

    // Process the selected file
    function handleFile(file: File) {
        if (!file) return;

        // Validate file type
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            toast.error(
                `Please select a valid image file (${ALLOWED_IMAGE_TYPES.map((t) => t.split("/")[1].toUpperCase()).join(", ")})`,
            );
            return;
        }

        // Validate file size
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
            toast.error(`Image size must be less than ${MAX_IMAGE_SIZE_MB}MB`);
            return;
        }

        // Set form data file
        formData.image = file;
    }

    // Handle drag and drop events
    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        isDragging = true;
    }

    function handleDragLeave() {
        isDragging = false;
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        isDragging = false;

        if (event.dataTransfer?.files?.length) {
            handleFile(event.dataTransfer.files[0]);
        }
    }

    // Handle form submission
    async function handleSubmit() {
        // Validation using validation utility
        if (
            !validateWithToast(formData, {
                name: [required("Please enter a name for your food log entry")],
            })
        ) {
            return;
        }

        isSubmitting = true;

        try {
            // Dispatch submit event with form data
            const submitData: FoodLogFormData & { id?: string } = {
                name: formData.name.trim(),
                tag: formData.tag,
                image: formData.image,
                date: formData.date,
            };

            // Include entry ID if editing
            if (mode === "edit" && editEntry) {
                submitData.id = editEntry.id;
            }

            dispatch("submit", submitData);

            // Reset form after successful dispatch (only for create mode)
            if (mode === "create") {
                resetForm();
            }
        } catch (error) {
            console.error("Error submitting form:", error);
            toast.error("Failed to submit form");
        } finally {
            isSubmitting = false;
        }
    }

    // Handle image removal
    function removeImage() {
        previewUrl = null;
        formData.image = undefined;
        if (fileInput) fileInput.value = "";
    }

    // Initialize drag and drop listeners
    onMount(() => {
        if (dropZone) {
            dropZone.addEventListener("dragover", handleDragOver);
            dropZone.addEventListener("dragleave", handleDragLeave);
            dropZone.addEventListener("drop", handleDrop);
        }

        return () => {
            if (dropZone) {
                dropZone.removeEventListener("dragover", handleDragOver);
                dropZone.removeEventListener("dragleave", handleDragLeave);
                dropZone.removeEventListener("drop", handleDrop);
            }
        };
    });
</script>

<div class="food-log-upload space-y-4">
    {#if !compact}
        <h2 class="text-2xl font-semibold tracking-tight">
            {mode === "edit" ? "Edit Food Entry" : "Add New Food Entry"}
        </h2>
    {/if}

    <form
        onsubmit={(e) => {
            e.preventDefault();
            handleSubmit();
        }}
        class="space-y-4"
    >
        <div class="space-y-2">
            <Label for="food-name">Food Name</Label>
            <Input
                id="food-name"
                type="text"
                placeholder="What did you eat?"
                bind:value={formData.name}
                required
                disabled={isSubmitting}
            />
        </div>

        <!-- Category selection -->
        <div class="space-y-2">
            <Label for="food-tag">Category</Label>
            <div class="select-wrapper">
                <select
                    id="food-tag"
                    class="w-full p-2 border rounded-md"
                    bind:value={selectedTag}
                    onchange={() => (formData.tag = selectedTag)}
                    disabled={isSubmitting}
                >
                    {#each FOOD_TAGS as tag}
                        <option value={tag.value}>{tag.label}</option>
                    {/each}
                </select>
            </div>
        </div>

        <!-- Date and time selection -->
        <div class="space-y-2">
            <Label for="food-date">When did you eat this?</Label>
            <DateTimePicker
                bind:value={datePickerValue}
                placeholder="Select date and time"
                on:change={(e: CustomEvent<Date>) => handleDateChange(e.detail)}
            />
            <div class="text-xs text-muted-foreground mt-1">
                {dateValue ? dateValue.toLocaleString() : "No date selected"}
            </div>
        </div>

        <div class="space-y-2">
            <Label for="food-image">Food Image (Optional)</Label>
            <div
                bind:this={dropZone}
                class="border-2 border-dashed p-6 rounded-lg text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center
					{isDragging ? 'border-primary bg-primary/5' : 'border-input'}
					{isSubmitting ? 'opacity-50 pointer-events-none' : ''}"
                onclick={() => !isSubmitting && fileInput?.click()}
                onkeydown={(e) =>
                    e.key === "Enter" && !isSubmitting && fileInput?.click()}
                tabindex="0"
                role="button"
                aria-label="Upload image"
            >
                {#if previewUrl}
                    <div
                        class="relative max-w-full max-h-64 overflow-hidden mb-2 group"
                    >
                        <img
                            src={previewUrl}
                            alt="Preview"
                            class="max-h-64 object-contain rounded-md"
                        />
                        <button
                            type="button"
                            class="absolute top-2 right-2 bg-white dark:bg-gray-800 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            onclick={(e) => {
                                e.stopPropagation();
                                removeImage();
                            }}
                            aria-label="Remove image"
                            disabled={isSubmitting}
                        >
                            <X class="h-4 w-4" />
                        </button>
                    </div>
                    <span class="text-sm text-muted-foreground"
                        >Click to change image</span
                    >
                {:else}
                    <Upload class="h-12 w-12 text-muted-foreground mb-2" />
                    <p class="text-sm text-muted-foreground">
                        Drag and drop an image, or click to select
                    </p>
                    <p class="text-xs text-muted-foreground mt-1">
                        JPG, PNG, GIF, WEBP up to {MAX_IMAGE_SIZE_MB}MB
                    </p>
                {/if}
                <input
                    bind:this={fileInput}
                    type="file"
                    id="food-image"
                    accept={ALLOWED_IMAGE_TYPES.join(",")}
                    class="hidden"
                    onchange={handleFileSelect}
                    disabled={isSubmitting}
                />
            </div>
        </div>

        <Button type="submit" class="w-full" disabled={isSubmitting}>
            {#if isSubmitting}
                <div class="flex items-center gap-2">
                    <div
                        class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"
                    ></div>
                    {mode === "edit" ? "Updating..." : "Adding..."}
                </div>
            {:else}
                {mode === "edit" ? "Update Food Log" : "Add to Food Log"}
            {/if}
        </Button>
    </form>
</div>

<style>
    .select-wrapper {
        position: relative;
    }

    .select-wrapper select {
        appearance: none;
        background-color: var(--background);
        color: var(--foreground);
        border-color: var(--input);
        height: 40px;
        padding-left: 14px;
        padding-right: 28px;
    }

    .select-wrapper::after {
        content: "";
        position: absolute;
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 5px solid currentColor;
        pointer-events: none;
    }

    .select-wrapper select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>

<!--
  QuickAddDialog Component
  
  Reusable dialog for quickly creating items with minimal fields.
  Supports title + optional select field (e.g., category).
-->
<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Button } from "$lib/components/ui/button";
    import * as Select from "$lib/components/ui/select";
    import LoadingSpinner from "$lib/components/LoadingSpinner.svelte";
    import { required, validateWithToast } from "$lib/utils";

    type SelectOption = {
        value: string;
        label: string;
    };

    let {
        open = $bindable(),
        title = "Quick Add",
        titleLabel = "Title",
        titlePlaceholder = "Enter title...",
        selectLabel,
        selectOptions,
        selectPlaceholder = "Select...",
        confirmText = "Create",
        onconfirm,
    } = $props<{
        open: boolean;
        title?: string;
        titleLabel?: string;
        titlePlaceholder?: string;
        selectLabel?: string;
        selectOptions?: SelectOption[];
        selectPlaceholder?: string;
        confirmText?: string;
        onconfirm?: (data: {
            title: string;
            selectedValue?: string;
        }) => Promise<void> | void;
    }>();

    let itemTitle = $state("");
    let selectedValue = $state<string | undefined>(undefined);
    let isProcessing = $state(false);

    // Reset form when dialog opens
    $effect(() => {
        if (open) {
            itemTitle = "";
            selectedValue = selectOptions?.[0]?.value;
        }
    });

    async function handleConfirm() {
        // Validate title
        if (
            !validateWithToast(
                { title: itemTitle },
                {
                    title: [required("Title is required")],
                },
            )
        ) {
            return;
        }

        if (!onconfirm) {
            open = false;
            return;
        }

        isProcessing = true;
        try {
            await onconfirm({
                title: itemTitle.trim(),
                selectedValue,
            });
            open = false;
        } finally {
            isProcessing = false;
        }
    }

    function handleCancel() {
        open = false;
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === "Enter" && !isProcessing) {
            handleConfirm();
        }
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
        </Dialog.Header>

        <div class="grid gap-4 py-4">
            <!-- Title Input -->
            <div class="grid gap-2">
                <Label for="quick-add-title">{titleLabel}</Label>
                <Input
                    id="quick-add-title"
                    placeholder={titlePlaceholder}
                    bind:value={itemTitle}
                    disabled={isProcessing}
                    onkeydown={handleKeyDown}
                    autofocus
                />
            </div>

            <!-- Optional Select Field -->
            {#if selectLabel && selectOptions && selectOptions.length > 0}
                <div class="grid gap-2">
                    <Label for="quick-add-select">{selectLabel}</Label>
                    <Select.Root
                        selected={{
                            value: selectedValue,
                            label:
                                selectOptions.find(
                                    (o: SelectOption) =>
                                        o.value === selectedValue,
                                )?.label || "",
                        }}
                        onSelectedChange={(v) => {
                            selectedValue = v?.value;
                        }}
                        disabled={isProcessing}
                    >
                        <Select.Trigger id="quick-add-select">
                            <Select.Value placeholder={selectPlaceholder} />
                        </Select.Trigger>
                        <Select.Content>
                            {#each selectOptions as option (option.value)}
                                <Select.Item value={option.value}>
                                    {option.label}
                                </Select.Item>
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </div>
            {/if}
        </div>

        <Dialog.Footer>
            <Button
                variant="outline"
                on:click={handleCancel}
                disabled={isProcessing}
            >
                Cancel
            </Button>
            <Button
                on:click={handleConfirm}
                disabled={isProcessing || !itemTitle.trim()}
            >
                {#if isProcessing}
                    <LoadingSpinner size="sm" class="mr-2" />
                {/if}
                {confirmText}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

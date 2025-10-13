<script lang="ts">
    import { onMount } from "svelte";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import * as Select from "$lib/components/ui/select";
    import { Switch } from "$lib/components/ui/switch";
    import { validateWithToast, required, minLength } from "$lib/utils";
    import type { DeveloperToken } from "../types";
    import { DEFAULT_DEV_TOKEN_FORM, ENVIRONMENTS } from "../types";

    interface Props {
        open: boolean;
        token?: DeveloperToken | null;
        onsubmit?: (data: Partial<DeveloperToken>) => void;
        onclose?: () => void;
    }

    let { open = $bindable(), token = null, onsubmit, onclose } = $props<Props>();

    let formData = $state({ ...DEFAULT_DEV_TOKEN_FORM });
    let selectedEnvironment = $state<{ value: string; label: string } | undefined>(undefined);

    const isEdit = $derived(!!token);
    const dialogTitle = $derived(isEdit ? "Edit Developer Token" : "Create Developer Token");
    const submitButtonText = $derived(isEdit ? "Update" : "Create");

    function resetForm() {
        formData = { ...DEFAULT_DEV_TOKEN_FORM };
        selectedEnvironment = ENVIRONMENTS[0];
    }

    function handleSubmit() {
        if (!validateWithToast(formData, {
            name: [required("Name is required"), minLength(3, "Name must be at least 3 characters")],
            environment: [required("Environment is required")],
        })) {
            return;
        }

        onsubmit?.(formData);
    }

    function handleClose() {
        resetForm();
        onclose?.();
    }

    onMount(() => {
        if (isEdit && token) {
            formData = {
                name: token.name,
                environment: token.environment,
                is_active: token.is_active,
            };
            selectedEnvironment = ENVIRONMENTS.find(e => e.value === token.environment);
        } else {
            selectedEnvironment = ENVIRONMENTS[0];
        }
    });

    $effect(() => {
        if (!open) {
            resetForm();
        }
    });
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>{dialogTitle}</Dialog.Title>
            <Dialog.Description>
                {isEdit ? "Update the developer token details" : "Generate a new developer token for API access"}
            </Dialog.Description>
        </Dialog.Header>

        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
            <div class="space-y-2">
                <Label for="name">Token Name</Label>
                <Input
                    id="name"
                    bind:value={formData.name}
                    placeholder="Production API Token"
                    required
                />
            </div>

            <div class="space-y-2">
                <Label for="environment">Environment</Label>
                <Select.Root
                    selected={selectedEnvironment}
                    onSelectedChange={(v) => {
                        selectedEnvironment = v;
                        formData.environment = v?.value || "development";
                    }}
                >
                    <Select.Trigger id="environment">
                        <Select.Value placeholder="Select environment" />
                    </Select.Trigger>
                    <Select.Content>
                        {#each ENVIRONMENTS as env}
                            <Select.Item value={env.value}>{env.label}</Select.Item>
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>

            <div class="flex items-center space-x-2">
                <Switch
                    id="is-active"
                    bind:checked={formData.is_active}
                />
                <Label for="is-active">Active</Label>
            </div>

            {#if !isEdit}
                <div class="rounded-lg bg-muted p-3 text-sm">
                    <p class="font-medium">Note:</p>
                    <p class="text-muted-foreground mt-1">
                        The token will be generated and displayed only once. Make sure to copy it before closing this dialog.
                    </p>
                </div>
            {/if}

            <Dialog.Footer>
                <Button type="button" variant="outline" onclick={handleClose}>
                    Cancel
                </Button>
                <Button type="submit">{submitButtonText}</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<script lang="ts">
    import { onMount } from "svelte";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import * as Select from "$lib/components/ui/select";
    import { validateWithToast, required, minLength } from "$lib/utils";
    import type { ApiKey } from "../types";
    import { DEFAULT_API_KEY_FORM, SERVICES } from "../types";

    interface Props {
        open: boolean;
        apiKey?: ApiKey | null;
        onsubmit?: (data: Partial<ApiKey>) => void;
        onclose?: () => void;
    }

    let { open = $bindable(), apiKey = null, onsubmit, onclose } = $props<Props>();

    let formData = $state({ ...DEFAULT_API_KEY_FORM });
    let selectedService = $state<{ value: string; label: string } | undefined>(undefined);
    let scopesInput = $state("");

    const isEdit = $derived(!!apiKey);
    const dialogTitle = $derived(isEdit ? "Edit API Key" : "Create API Key");
    const submitButtonText = $derived(isEdit ? "Update" : "Create");

    function resetForm() {
        formData = { ...DEFAULT_API_KEY_FORM };
        selectedService = undefined;
        scopesInput = "";
    }

    function handleSubmit() {
        if (!validateWithToast(formData, {
            name: [required("Name is required"), minLength(3, "Name must be at least 3 characters")],
            service: [required("Service is required")],
            key: [required("API key is required"), minLength(10, "Key must be at least 10 characters")],
        })) {
            return;
        }

        const scopes = scopesInput
            .split(",")
            .map(s => s.trim())
            .filter(s => s.length > 0);

        onsubmit?.({
            ...formData,
            scopes,
        });
    }

    function handleClose() {
        resetForm();
        onclose?.();
    }

    onMount(() => {
        if (isEdit && apiKey) {
            formData = {
                name: apiKey.name,
                description: apiKey.description || "",
                service: apiKey.service,
                key: apiKey.key,
                secret: apiKey.secret || "",
                scopes: apiKey.scopes || [],
                is_active: apiKey.is_active,
            };
            selectedService = SERVICES.find(s => s.value === apiKey.service);
            scopesInput = apiKey.scopes?.join(", ") || "";
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
                {isEdit ? "Update the API key details" : "Add a new API key to your credentials"}
            </Dialog.Description>
        </Dialog.Header>

        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
            <div class="space-y-2">
                <Label for="name">Name</Label>
                <Input
                    id="name"
                    bind:value={formData.name}
                    placeholder="My API Key"
                    required
                />
            </div>

            <div class="space-y-2">
                <Label for="description">Description</Label>
                <Textarea
                    id="description"
                    bind:value={formData.description}
                    placeholder="Optional description"
                    rows={2}
                />
            </div>

            <div class="space-y-2">
                <Label for="service">Service</Label>
                <Select.Root
                    selected={selectedService}
                    onSelectedChange={(v) => {
                        selectedService = v;
                        formData.service = v?.value || "";
                    }}
                >
                    <Select.Trigger id="service">
                        <Select.Value placeholder="Select a service" />
                    </Select.Trigger>
                    <Select.Content>
                        {#each SERVICES as service}
                            <Select.Item value={service.value}>{service.label}</Select.Item>
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>

            <div class="space-y-2">
                <Label for="key">API Key</Label>
                <Input
                    id="key"
                    type="password"
                    bind:value={formData.key}
                    placeholder="Enter API key"
                    required
                />
            </div>

            <div class="space-y-2">
                <Label for="secret">Secret (Optional)</Label>
                <Input
                    id="secret"
                    type="password"
                    bind:value={formData.secret}
                    placeholder="Enter secret if required"
                />
            </div>

            <div class="space-y-2">
                <Label for="scopes">Scopes (Optional)</Label>
                <Input
                    id="scopes"
                    bind:value={scopesInput}
                    placeholder="read, write, admin (comma separated)"
                />
                <p class="text-xs text-muted-foreground">Separate multiple scopes with commas</p>
            </div>

            <Dialog.Footer>
                <Button type="button" variant="outline" onclick={handleClose}>
                    Cancel
                </Button>
                <Button type="submit">{submitButtonText}</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

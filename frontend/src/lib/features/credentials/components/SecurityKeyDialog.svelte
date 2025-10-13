<script lang="ts">
    import { onMount } from "svelte";
    import { createEventDispatcher } from "svelte";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Switch } from "$lib/components/ui/switch";
    import { validateWithToast, required, minLength } from "$lib/utils";
    import type { SecurityKey } from "../types";
    import { DEFAULT_SECURITY_KEY_FORM } from "../types";

    interface Props {
        open: boolean;
        key?: SecurityKey | null;
    }

    let { open = $bindable(), key = null } = $props<Props>();

    const dispatch = createEventDispatcher();

    let formData = $state({ ...DEFAULT_SECURITY_KEY_FORM });

    const isEdit = $derived(!!key);
    const dialogTitle = $derived(isEdit ? "Edit Security Key" : "Create Security Key");
    const submitButtonText = $derived(isEdit ? "Update" : "Create");

    function resetForm() {
        formData = { ...DEFAULT_SECURITY_KEY_FORM };
    }

    function handleSubmit() {
        if (!validateWithToast(formData, {
            name: [required("Name is required"), minLength(3, "Name must be at least 3 characters")],
            private_key: [required("Private key is required"), minLength(32, "Private key is too short")],
            public_key: [required("Public key is required"), minLength(32, "Public key is too short")],
        })) {
            return;
        }

        dispatch("submit", formData);
    }

    function handleClose() {
        resetForm();
        dispatch("close");
    }

    onMount(() => {
        if (isEdit && key) {
            formData = {
                name: key.name,
                description: key.description || "",
                private_key: key.private_key,
                public_key: key.public_key,
                is_active: key.is_active,
            };
        }
    });

    $effect(() => {
        if (!open) {
            resetForm();
        }
    });
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
    <Dialog.Content class="max-w-2xl max-h-[90vh] overflow-y-auto">
        <Dialog.Header>
            <Dialog.Title>{dialogTitle}</Dialog.Title>
            <Dialog.Description>
                {isEdit ? "Update the security key details" : "Add a new SSH or security key pair"}
            </Dialog.Description>
        </Dialog.Header>

        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
            <div class="space-y-2">
                <Label for="name">Key Name</Label>
                <Input
                    id="name"
                    bind:value={formData.name}
                    placeholder="Production Server SSH Key"
                    required
                />
            </div>

            <div class="space-y-2">
                <Label for="description">Description</Label>
                <Textarea
                    id="description"
                    bind:value={formData.description}
                    placeholder="Optional description of this key"
                    rows={2}
                />
            </div>

            <div class="space-y-2">
                <Label for="public_key">Public Key</Label>
                <Textarea
                    id="public_key"
                    bind:value={formData.public_key}
                    placeholder="ssh-ed25519 AAAA... or ssh-rsa AAAA..."
                    rows={3}
                    required
                    class="font-mono text-xs"
                />
                <p class="text-xs text-muted-foreground">
                    The public key can be safely shared with services
                </p>
            </div>

            <div class="space-y-2">
                <Label for="private_key">Private Key</Label>
                <Textarea
                    id="private_key"
                    bind:value={formData.private_key}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                    rows={8}
                    required
                    class="font-mono text-xs"
                />
                <p class="text-xs text-destructive">
                    Keep this private! Never share your private key.
                </p>
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
                    <p class="font-medium">Security Note:</p>
                    <p class="text-muted-foreground mt-1">
                        Your keys are encrypted in storage. However, be cautious about where you generate and store them.
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

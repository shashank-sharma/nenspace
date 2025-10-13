<script lang="ts">
    import { Eye, EyeOff, KeyRound, LoaderCircle, Lock } from "lucide-svelte";
    import * as Dialog from "$lib/components/ui/dialog";
    import {
        Select,
        SelectContent,
        SelectItem,
        SelectTrigger,
        SelectValue,
    } from "$lib/components/ui/select";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Switch } from "$lib/components/ui/switch";
    import { Separator } from "$lib/components/ui/separator";
    import { toast } from "svelte-sonner";
    import {
        KEY_TYPES,
        DEFAULT_SECURITY_KEY_FORM,
    } from "$lib/features/credentials/types";
    import type { SecurityKey } from "$lib/features/credentials/types";
    import { pb } from "$lib/config/pocketbase";

    let {
        open = $bindable(),
        onClose,
        onSubmit,
        selectedKey = null,
    } = $props<{
        open?: boolean;
        onClose: () => void;
        onSubmit: (data: any) => Promise<void>;
        selectedKey: SecurityKey | null;
    }>();

    let showPrivateKey = $state(false);
    let formData = $state({ ...DEFAULT_SECURITY_KEY_FORM });
    let isSubmitting = $state(false);
    let selectedKeyType = $state("ed25519");
    let isGenerating = $state(false);

    // Effect to initialize form data when the dialog opens or the selected key changes
    $effect(() => {
        if (open) {
            if (selectedKey) {
                // For editing: Make a deep copy to prevent reference issues
                formData = JSON.parse(
                    JSON.stringify({
                        ...DEFAULT_SECURITY_KEY_FORM,
                        ...selectedKey,
                        // Ensure is_active is a boolean
                        is_active:
                            selectedKey.is_active === undefined
                                ? true
                                : !!selectedKey.is_active,
                    }),
                );
            } else {
                // For new keys: Reset to default
                formData = { ...DEFAULT_SECURITY_KEY_FORM };
            }
        }
    });

    // Additional cleanup when dialog closes
    $effect(() => {
        if (!open) {
            showPrivateKey = false;
            isGenerating = false;
        }
    });

    function generateRandomName() {
        const adjectives = [
            "swift",
            "secure",
            "cryptic",
            "hidden",
            "private",
            "quantum",
            "cyber",
            "digital",
            "secret",
            "protected",
        ];
        const nouns = [
            "key",
            "tunnel",
            "gate",
            "portal",
            "channel",
            "pass",
            "access",
            "vault",
            "shield",
            "guardian",
        ];

        const randomAdjective =
            adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNumbers = Math.floor(Math.random() * 900) + 100; // 3-digit number

        return `${randomAdjective}-${randomNoun}-${randomNumbers}`;
    }

    function handleKeyChange(value: string | undefined) {
        if (value) {
            selectedKeyType = value;
        }
    }

    async function generateSSHKey() {
        isGenerating = true;
        try {
            // Use our backend API to generate SSH keys securely
            const response = await pb.send("/api/security-keys/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    key_type: selectedKeyType,
                }),
            });

            if (response && response.private_key && response.public_key) {
                formData.name = generateRandomName();
                formData.description = `Auto-generated ${selectedKeyType.toUpperCase()} SSH key`;
                formData.private_key = response.private_key;
                formData.public_key = response.public_key;

                toast.success(
                    `${selectedKeyType.toUpperCase()} SSH key generated successfully`,
                );
            } else {
                throw new Error("Invalid response from server");
            }
        } catch (error: any) {
            console.error("Key generation error:", error);
            toast.error(
                "Failed to generate SSH key: " +
                    (error.message || "Unknown error"),
            );
        } finally {
            isGenerating = false;
        }
    }

    async function handleSubmit() {
        // Final validation before submission
        if (!formData.name) {
            toast.error("Please enter a key name");
            return;
        }

        if (!formData.private_key || !formData.public_key) {
            toast.error(
                "Missing key data. Please generate or enter keys manually.",
            );
            return;
        }

        // Create a clean copy of the data to submit
        const dataToSubmit: any = {
            name: formData.name,
            description: formData.description || "",
            private_key: formData.private_key,
            public_key: formData.public_key,
            is_active:
                formData.is_active === undefined ? true : !!formData.is_active,
        };

        // Add ID if editing
        if (selectedKey?.id) {
            dataToSubmit.id = selectedKey.id;
        }

        isSubmitting = true;
        try {
            await onSubmit(dataToSubmit);
        } catch (error: any) {
            console.error("Submit error:", error);
            toast.error("Failed to submit security key");
        } finally {
            isSubmitting = false;
        }
    }
</script>

<Dialog.Root bind:open onOpenChange={onClose}>
    <Dialog.Content
        class="sm:max-w-[550px] overflow-y-auto max-h-[90vh] w-full mx-auto"
    >
        <Dialog.Header>
            <Dialog.Title>
                {selectedKey ? "Edit Security Key" : "Add New Security Key"}
            </Dialog.Title>
            <Dialog.Description>
                {selectedKey
                    ? "Modify your security key details"
                    : "Add a new SSH key for secure server connections"}
            </Dialog.Description>
        </Dialog.Header>

        <form class="space-y-4" onsubmit={handleSubmit}>
            <div class="space-y-2">
                <Label for="name">Key Name *</Label>
                <Input
                    id="name"
                    bind:value={formData.name}
                    placeholder="e.g. GitHub SSH Key"
                    required
                />
            </div>

            <div class="space-y-2">
                <Label for="description">Description</Label>
                <Textarea
                    id="description"
                    bind:value={formData.description}
                    placeholder="Add a description for this key (optional)"
                    rows={2}
                />
            </div>

            {#if !selectedKey}
                <div class="bg-muted p-3 rounded-md">
                    <h4 class="text-sm font-medium mb-2 flex items-center">
                        <KeyRound class="w-4 h-4 mr-1" />
                        Generate New SSH Key
                    </h4>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                            <Label for="key-type" class="text-xs"
                                >Key Type</Label
                            >
                            <Select onValueChange={handleKeyChange}>
                                <SelectTrigger id="key-type" class="w-full">
                                    <SelectValue
                                        placeholder="Select key type"
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {#each KEY_TYPES as keyType}
                                        <SelectItem value={keyType.value}>
                                            {keyType.label}
                                        </SelectItem>
                                    {/each}
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="flex items-end">
                            <Button
                                type="button"
                                variant="ghost"
                                class="w-full"
                                onclick={generateSSHKey}
                                disabled={isGenerating}
                            >
                                {#if isGenerating}
                                    <LoaderCircle
                                        class="mr-2 h-4 w-4 animate-spin"
                                    />
                                    Generating...
                                {:else}
                                    Generate Keys
                                {/if}
                            </Button>
                        </div>
                    </div>

                    <p class="text-xs text-muted-foreground">
                        <Lock class="w-3 h-3 inline-block mr-1" />
                        Keys are generated securely and encrypted when stored
                    </p>
                </div>

                <Separator />
            {/if}

            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <Label for="public_key">Public Key *</Label>
                </div>
                <Textarea
                    id="public_key"
                    rows={3}
                    class="font-mono text-xs"
                    bind:value={formData.public_key}
                    placeholder="Paste your public key here"
                />
            </div>

            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <Label for="private_key">Private Key *</Label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="h-7 px-2"
                        onclick={() => (showPrivateKey = !showPrivateKey)}
                    >
                        {#if showPrivateKey}
                            <EyeOff class="w-3 h-3 mr-1" /> Hide
                        {:else}
                            <Eye class="w-3 h-3 mr-1" /> Show
                        {/if}
                    </Button>
                </div>
                {#if showPrivateKey}
                    <Textarea
                        id="private_key"
                        rows={5}
                        class="font-mono text-xs"
                        bind:value={formData.private_key}
                        placeholder="Paste your private key here"
                    />
                {:else}
                    <Textarea
                        id="private_key_hidden"
                        rows={5}
                        class="font-mono text-xs text-password"
                        bind:value={formData.private_key}
                        placeholder="Paste your private key here"
                    />
                {/if}
                <p class="text-xs text-muted-foreground">
                    <Lock class="w-3 h-3 inline-block mr-1" />
                    Your private key will be encrypted when stored and never shared
                </p>
            </div>

            <div class="flex items-center space-x-2">
                <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked: boolean) => {
                        formData.is_active = checked;
                    }}
                />
                <Label for="is_active" class="cursor-pointer">
                    <span>Active</span>
                    <span
                        class="ml-2 text-xs rounded-full px-2 py-0.5 {formData.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'}"
                    >
                        {formData.is_active ? "Yes" : "No"}
                    </span>
                </Label>
            </div>

            <Dialog.Footer class="flex flex-col sm:flex-row gap-2 mt-6">
                <Button
                    type="button"
                    variant="outline"
                    class="w-full sm:w-auto"
                    onclick={onClose}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    disabled={isSubmitting}
                    class="w-full sm:w-auto"
                >
                    {isSubmitting
                        ? selectedKey
                            ? "Updating..."
                            : "Creating..."
                        : selectedKey
                          ? "Update"
                          : "Create"} Key
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<style>
    /* No custom styles needed */
</style>

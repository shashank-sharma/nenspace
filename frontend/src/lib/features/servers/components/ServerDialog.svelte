<script lang="ts">
    import { onMount } from "svelte";
    import { KeyRound, ServerIcon, Terminal, AlertCircle } from "lucide-svelte";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Switch } from "$lib/components/ui/switch";
    import { PROVIDERS } from "../constants";
    import { DEFAULT_SERVER_FORM } from "../types";
    import type { SecurityKey, Server } from "../types";
    import { toast } from "svelte-sonner";
    import { pb } from "$lib/config/pocketbase";
    import { Loader2 } from "lucide-svelte";
    import type { SecurityKey as CredentialSecurityKey } from "$lib/features/credentials/types";

    let {
        open = $bindable(),
        onClose,
        onSubmit,
        selectedServer = null,
    } = $props<{
        open?: boolean;
        onClose: () => void;
        onSubmit: (data: any) => Promise<void>;
        selectedServer: Server | null;
    }>();

    let formData = $state({ ...DEFAULT_SERVER_FORM });
    let isSubmitting = $state(false);
    let securityKeys = $state<CredentialSecurityKey[]>([]);
    let loadingKeys = $state(false);
    let formInitialized = $state(false);
    let formErrors = $state<Record<string, string>>({});

    $effect(() => {
        if (open && !formInitialized) {
            initializeForm();
        } else if (!open) {
            formInitialized = false;
            formErrors = {};
        }
    });

    function initializeForm() {
        if (selectedServer) {
            formData = {
                name: selectedServer.name,
                provider: selectedServer.provider,
                ip: selectedServer.ip,
                port: selectedServer.port,
                username: selectedServer.username,
                security_key: selectedServer.security_key,
                ssh_enabled: selectedServer.ssh_enabled,
                is_active: selectedServer.is_active,
            };
            loadSecurityKeys();
        } else {
            formData = { ...DEFAULT_SERVER_FORM };
            loadSecurityKeys();
        }
    }

    async function loadSecurityKeys() {
        loadingKeys = true;
        try {
            const records = await pb.collection("security_keys").getFullList({
                sort: "-created",
                filter: "is_active=true",
            });
            securityKeys = records as unknown as CredentialSecurityKey[];
        } catch (error) {
            console.error("Failed to load security keys:", error);
            toast.error("Failed to load security keys");
        } finally {
            loadingKeys = false;
        }
    }

    function validateForm(): boolean {
        formErrors = {};

        if (!formData.name || formData.name.trim() === "") {
            formErrors.name = "Server name is required";
        }

        if (!formData.provider || formData.provider.trim() === "") {
            formErrors.provider = "Provider is required";
        }

        if (!formData.ip || formData.ip.trim() === "") {
            formErrors.ip = "IP address is required";
        } else {
            const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            const hostnameRegex = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;
            if (!ipRegex.test(formData.ip) && !hostnameRegex.test(formData.ip)) {
                formErrors.ip = "Please enter a valid IP address or hostname";
            }
        }

        if (formData.port && (formData.port < 1 || formData.port > 65535)) {
            formErrors.port = "Port must be between 1 and 65535";
        }

        if (formData.ssh_enabled) {
            if (!formData.username || formData.username.trim() === "") {
                formErrors.username = "Username is required for SSH";
            }

            if (!formData.security_key || formData.security_key.trim() === "") {
                formErrors.security_key = "Security key is required for SSH";
            }
        }

        return Object.keys(formErrors).length === 0;
    }

    async function handleSubmit(e: Event) {
        e.preventDefault();
        if (!validateForm()) {
            toast.error("Please fix the form errors");
            return;
        }

        isSubmitting = true;
        try {
            await onSubmit({
                ...formData,
                is_reachable: formData.ssh_enabled ? formData.is_reachable : false,
            });
        } catch (error) {
            console.error("Failed to submit server:", error);
            toast.error("Failed to submit server");
        } finally {
            isSubmitting = false;
        }
    }

    onMount(() => {
        if (open) {
            loadSecurityKeys();
        }
    });
</script>

<Dialog.Root bind:open onOpenChange={onClose}>
    <Dialog.Content class="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <Dialog.Header>
            <Dialog.Title>
                {selectedServer ? "Edit Server" : "Create New Server"}
            </Dialog.Title>
            <Dialog.Description>
                {selectedServer
                    ? "Modify your server details"
                    : "Add a new server to manage"}
            </Dialog.Description>
        </Dialog.Header>

        <form onsubmit={handleSubmit} class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                    <Label for="name">Server Name *</Label>
                    <Input
                        id="name"
                        bind:value={formData.name}
                        placeholder="Enter server name"
                        required
                        class={formErrors.name ? "border-destructive" : ""}
                    />
                    {#if formErrors.name}
                        <p class="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle class="h-3 w-3" />
                            {formErrors.name}
                        </p>
                    {/if}
                </div>

                <div class="space-y-2">
                    <Label for="provider">Provider *</Label>
                    <div class="relative w-full">
                        <select
                            id="provider"
                            class={cn(
                                "w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                                formErrors.provider && "border-destructive"
                            )}
                            bind:value={formData.provider}
                        >
                            <option value="" disabled>Select provider</option>
                            {#each PROVIDERS as provider}
                                <option value={provider.value}
                                    >{provider.label}</option
                                >
                            {/each}
                        </select>
                    </div>
                    {#if formErrors.provider}
                        <p class="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle class="h-3 w-3" />
                            {formErrors.provider}
                        </p>
                    {/if}
                </div>

                <div class="space-y-2 col-span-2">
                    <Label for="ip">IP Address *</Label>
                    <Input
                        id="ip"
                        bind:value={formData.ip}
                        placeholder="Enter server IP address or hostname"
                        required
                        class={formErrors.ip ? "border-destructive" : ""}
                    />
                    {#if formErrors.ip}
                        <p class="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle class="h-3 w-3" />
                            {formErrors.ip}
                        </p>
                    {/if}
                </div>
            </div>

            <div class="pt-2">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2">
                        <Terminal class="h-4 w-4" />
                        <div class="flex flex-col">
                            <h3 class="text-sm font-medium">Enable SSH</h3>
                            <p class="text-xs text-muted-foreground">
                                Connect to this server via SSH
                            </p>
                        </div>
                    </div>
                    <Switch
                        checked={formData.ssh_enabled}
                        onCheckedChange={(checked: boolean) => {
                            formData.ssh_enabled = checked;
                            if (!checked) {
                                formData.username = "";
                                formData.security_key = "";
                            }
                        }}
                    />
                </div>

                {#if formData.ssh_enabled}
                    <div class="space-y-4 pl-2 border-l-2 border-muted mt-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <Label for="username">Username *</Label>
                                <Input
                                    id="username"
                                    bind:value={formData.username}
                                    placeholder="Enter username"
                                    class={formErrors.username ? "border-destructive" : ""}
                                />
                                {#if formErrors.username}
                                    <p class="text-xs text-destructive flex items-center gap-1">
                                        <AlertCircle class="h-3 w-3" />
                                        {formErrors.username}
                                    </p>
                                {/if}
                            </div>
                            <div class="space-y-2">
                                <Label for="port">Port</Label>
                                <Input
                                    id="port"
                                    type="number"
                                    bind:value={formData.port}
                                    placeholder="22"
                                    min="1"
                                    max="65535"
                                    class={formErrors.port ? "border-destructive" : ""}
                                />
                                {#if formErrors.port}
                                    <p class="text-xs text-destructive flex items-center gap-1">
                                        <AlertCircle class="h-3 w-3" />
                                        {formErrors.port}
                                    </p>
                                {/if}
                            </div>
                        </div>

                        <div class="space-y-2">
                            <Label
                                for="security-key"
                                class="flex items-center gap-1"
                            >
                                <KeyRound class="h-3.5 w-3.5" />
                                <span>Security Key *</span>
                            </Label>
                            <div class="relative w-full">
                                <select
                                    id="security-key"
                                    class={cn(
                                        "w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                                        formErrors.security_key && "border-destructive"
                                    )}
                                    bind:value={formData.security_key}
                                >
                                    <option value="" disabled
                                        >Select security key</option
                                    >
                                    {#if loadingKeys}
                                        <option value="" disabled
                                            >Loading keys...</option
                                        >
                                    {:else if securityKeys.length === 0}
                                        <option value="" disabled
                                            >No security keys available</option
                                        >
                                    {:else}
                                        {#each securityKeys as key}
                                            <option value={key.id}
                                                >{key.name}</option
                                            >
                                        {/each}
                                    {/if}
                                </select>
                            </div>
                            {#if formErrors.security_key}
                                <p class="text-xs text-destructive flex items-center gap-1">
                                    <AlertCircle class="h-3 w-3" />
                                    {formErrors.security_key}
                                </p>
                            {/if}
                            <p class="text-xs text-muted-foreground">
                                Select a security key to use for SSH connection
                            </p>
                        </div>
                    </div>
                {/if}
            </div>

            <div class="flex items-center space-x-2">
                <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked: boolean) => {
                        formData.is_active = checked;
                    }}
                />
                <Label for="is_active">Active</Label>
            </div>

            <Dialog.Footer class="mt-6">
                <Button type="button" variant="outline" on:click={onClose} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                    {#if isSubmitting}
                        <Loader2 class="h-4 w-4 mr-2 animate-spin" />
                    {/if}
                    {isSubmitting
                        ? selectedServer
                            ? "Updating..."
                            : "Creating..."
                        : selectedServer
                          ? "Update"
                          : "Create"} Server
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

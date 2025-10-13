<script lang="ts">
    import { pb } from "$lib/config/pocketbase";
    import { toast } from "svelte-sonner";
    import { Plus, RefreshCcw } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import ServerCard from "./ServerCard.svelte";
    import ServerDialog from "./ServerDialog.svelte";
    import SSHTerminal from "./SSHTerminal.svelte";
    import * as AlertDialog from "$lib/components/ui/alert-dialog";
    import type { Server } from "../types";

    let servers = $state<Server[]>([]);
    let loading = $state(true);
    let showDialog = $state(false);
    let showDeleteDialog = $state(false);
    let showSSHTerminal = $state(false);
    let selectedServer = $state<Server | null>(null);
    let serverToDelete = $state<string | null>(null);

    async function loadServers() {
        loading = true;
        try {
            const records = await pb.collection("servers").getFullList({
                sort: "-created",
                expand: "user",
            });
            servers = records as unknown as Server[];
        } catch (error) {
            console.error("Load servers error:", error);
            toast.error("Failed to load servers");
        } finally {
            loading = false;
        }
    }

    $effect(() => {
        loadServers();
    });

    async function handleServerSubmit(data: any) {
        try {
            const submissionData = {
                name: data.name,
                provider: data.provider,
                ip: data.ip,
                port: data.port || 22,
                username: data.username || "",
                security_key: data.security_key || null,
                ssh_enabled: !!data.ssh_enabled,
                is_active: !!data.is_active,
                is_reachable: !!data.is_reachable,
            };

            if (selectedServer) {
                await pb
                    .collection("servers")
                    .update(selectedServer.id, submissionData);
                toast.success("Server updated successfully");
            } else {
                const serverData = {
                    ...submissionData,
                    user: pb.authStore.model?.id,
                };
                await pb.collection("servers").create(serverData);
                toast.success("Server created successfully");
            }
            showDialog = false;
            selectedServer = null;
            await loadServers();
        } catch (error) {
            console.error("Server submission error:", error);
            toast.error(
                selectedServer
                    ? "Failed to update server"
                    : "Failed to create server",
            );
        }
    }

    function handleEdit(server: Server) {
        selectedServer = server;
        showDialog = true;
    }

    function handleDelete(id: string) {
        serverToDelete = id;
        showDeleteDialog = true;
    }

    function handleSSH(server: Server) {
        selectedServer = server;
        showSSHTerminal = true;
    }

    async function confirmDelete() {
        if (!serverToDelete) return;
        try {
            await pb.collection("servers").delete(serverToDelete);
            toast.success("Server deleted successfully");
            loadServers();
        } catch (error) {
            toast.error("Failed to delete server");
        } finally {
            showDeleteDialog = false;
            serverToDelete = null;
        }
    }

    async function handleToggleStatus(id: string, currentStatus: boolean) {
        try {
            await pb.collection("servers").update(id, {
                is_active: !currentStatus,
            });
            toast.success("Server status updated");
            loadServers();
        } catch (error) {
            toast.error("Failed to update server status");
        }
    }
</script>

<div class="container mx-auto p-4">
    <div class="flex justify-between items-center mb-6">
        <h2 class="text-3xl font-bold">Servers</h2>
        <Button
            on:click={() => {
                selectedServer = null;
                showDialog = true;
            }}
        >
            <Plus class="w-4 h-4 mr-2" />
            New Server
        </Button>
    </div>

    {#if loading}
        <div class="flex justify-center items-center h-64">
            <RefreshCcw class="w-8 h-8 animate-spin" />
        </div>
    {:else if servers.length === 0}
        <div class="text-center py-8">
            <p class="text-muted-foreground">No servers found</p>
            <Button
                variant="outline"
                class="mt-4"
                on:click={() => {
                    selectedServer = null;
                    showDialog = true;
                }}
            >
                <Plus class="w-4 h-4 mr-2" />
                Add Your First Server
            </Button>
        </div>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each servers as server (server.id)}
                <ServerCard
                    {server}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleStatus={handleToggleStatus}
                    onSSH={handleSSH}
                />
            {/each}
        </div>
    {/if}

    <ServerDialog
        bind:open={showDialog}
        {selectedServer}
        onClose={() => {
            showDialog = false;
            selectedServer = null;
        }}
        onSubmit={handleServerSubmit}
    />

    <SSHTerminal
        bind:open={showSSHTerminal}
        server={selectedServer}
        onClose={() => {
            showSSHTerminal = false;
            selectedServer = null;
        }}
    />

    <AlertDialog.Root bind:open={showDeleteDialog}>
        <AlertDialog.Content>
            <AlertDialog.Header>
                <AlertDialog.Title>Are you sure?</AlertDialog.Title>
                <AlertDialog.Description>
                    This action cannot be undone. This will permanently delete
                    the server.
                </AlertDialog.Description>
            </AlertDialog.Header>
            <AlertDialog.Footer>
                <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                <AlertDialog.Action on:click={confirmDelete}
                    >Delete</AlertDialog.Action
                >
            </AlertDialog.Footer>
        </AlertDialog.Content>
    </AlertDialog.Root>
</div>

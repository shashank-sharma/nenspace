<script lang="ts">
    import { toast } from "svelte-sonner";
    import { Plus, RefreshCcw, Loader2, Filter, ArrowUpDown } from "lucide-svelte";
    import { Button } from "$lib/components/ui/button";
    import { Card } from "$lib/components/ui/card";
    import * as Select from "$lib/components/ui/select";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import ServerCard from "./ServerCard.svelte";
    import ServerDialog from "./ServerDialog.svelte";
    import ServerSearchBar from "./ServerSearchBar.svelte";
    import ServerStatusBar from "./ServerStatusBar.svelte";
    import SSHTerminal from "./SSHTerminal.svelte";
    import * as AlertDialog from "$lib/components/ui/alert-dialog";
    import { serverStore } from "../stores";
    import { pb } from "$lib/config/pocketbase";
    import type { Server } from "../types";
    import { PROVIDERS } from "../constants";
    import { onMount } from "svelte";

    let showDialog = $state(false);
    let showDeleteDialog = $state(false);
    let showSSHTerminal = $state(false);
    let selectedServer = $state<Server | null>(null);
    let serverToDelete = $state<string | null>(null);
    let unsubscribeServers: (() => void) | null = null;

    const servers = $derived(serverStore.filteredServers);
    const isLoading = $derived(serverStore.isLoading);
    const error = $derived(serverStore.error);
    const hasServers = $derived(serverStore.hasServers);

    $effect(() => {
        if (!serverStore.hasAttemptedFetch) {
            serverStore.fetchServers(true);
        }
    });

    $effect(() => {
        if (unsubscribeServers) return;

        pb.collection("servers")
            .subscribe("*", (e: { action: string; record: Server }) => {
                if (e.action === "create") {
                    serverStore.upsertServer(e.record);
                } else if (e.action === "update") {
                    serverStore.upsertServer(e.record);
                } else if (e.action === "delete") {
                    serverStore.removeServer(e.record.id);
                }
            })
            .then((unsub) => {
                unsubscribeServers = unsub;
            })
            .catch((error) => {
                console.error("Failed to subscribe to servers:", error);
                toast.error("Failed to connect to realtime updates");
            });

        return () => {
            if (unsubscribeServers) {
                unsubscribeServers();
                unsubscribeServers = null;
            }
        };
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
                await serverStore.updateServer(selectedServer.id, submissionData);
                toast.success("Server updated successfully");
            } else {
                await serverStore.createServer(submissionData);
                toast.success("Server created successfully");
            }
            showDialog = false;
            selectedServer = null;
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
            await serverStore.deleteServer(serverToDelete);
            toast.success("Server deleted successfully");
        } catch (error) {
            toast.error("Failed to delete server");
        } finally {
            showDeleteDialog = false;
            serverToDelete = null;
        }
    }

    async function handleToggleStatus(id: string, currentStatus: boolean) {
        try {
            await serverStore.toggleStatus(id, !currentStatus);
            toast.success("Server status updated");
        } catch (error) {
            toast.error("Failed to update server status");
        }
    }

    function handleFilterChange(filter: Partial<typeof serverStore.filter>) {
        serverStore.setFilter(filter);
        serverStore.fetchServers(true);
    }

    function handleSortChange(field: typeof serverStore.sortOptions.field, order: typeof serverStore.sortOptions.order) {
        serverStore.setSortOptions({ field, order });
    }
</script>

<div class="container mx-auto p-4 space-y-4">
    <div class="flex justify-between items-center">
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

    <ServerStatusBar />
    <ServerSearchBar />

    <!-- Filter and Sort Controls -->
    <div class="flex flex-wrap items-center gap-2">
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild let:builder>
                {#snippet trigger(builder)}
                    <Button variant="outline" size="sm" builders={[builder]}>
                        <Filter class="w-4 h-4 mr-2" />
                        Filters
                    </Button>
                {/snippet}
                {@render trigger(builder)}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
                <DropdownMenu.Label>Status</DropdownMenu.Label>
                <DropdownMenu.Item
                    on:click={() => handleFilterChange({ isActive: true })}
                >
                    Active
                </DropdownMenu.Item>
                <DropdownMenu.Item
                    on:click={() => handleFilterChange({ isActive: false })}
                >
                    Inactive
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Label>Reachability</DropdownMenu.Label>
                <DropdownMenu.Item
                    on:click={() => handleFilterChange({ isReachable: true })}
                >
                    Reachable
                </DropdownMenu.Item>
                <DropdownMenu.Item
                    on:click={() => handleFilterChange({ isReachable: false })}
                >
                    Unreachable
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Label>SSH</DropdownMenu.Label>
                <DropdownMenu.Item
                    on:click={() => handleFilterChange({ sshEnabled: true })}
                >
                    SSH Enabled
                </DropdownMenu.Item>
                <DropdownMenu.Item
                    on:click={() => handleFilterChange({ sshEnabled: false })}
                >
                    SSH Disabled
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Label>Provider</DropdownMenu.Label>
                {#each PROVIDERS as provider}
                    <DropdownMenu.Item
                        on:click={() => handleFilterChange({ provider: provider.value })}
                    >
                        {provider.label}
                    </DropdownMenu.Item>
                {/each}
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                    on:click={() => {
                        serverStore.clearFilter();
                        serverStore.fetchServers(true);
                    }}
                >
                    Clear Filters
                </DropdownMenu.Item>
            </DropdownMenu.Content>
        </DropdownMenu.Root>

        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild let:builder>
                <Button variant="outline" size="sm" builders={[builder]}>
                    <ArrowUpDown class="w-4 h-4 mr-2" />
                    Sort
                </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
                <DropdownMenu.Label>Sort By</DropdownMenu.Label>
                <DropdownMenu.Item
                    on:click={() => handleSortChange("name", "asc")}
                >
                    Name (A-Z)
                </DropdownMenu.Item>
                <DropdownMenu.Item
                    on:click={() => handleSortChange("name", "desc")}
                >
                    Name (Z-A)
                </DropdownMenu.Item>
                <DropdownMenu.Item
                    on:click={() => handleSortChange("provider", "asc")}
                >
                    Provider (A-Z)
                </DropdownMenu.Item>
                <DropdownMenu.Item
                    on:click={() => handleSortChange("created", "desc")}
                >
                    Newest First
                </DropdownMenu.Item>
                <DropdownMenu.Item
                    on:click={() => handleSortChange("created", "asc")}
                >
                    Oldest First
                </DropdownMenu.Item>
                <DropdownMenu.Item
                    on:click={() => handleSortChange("is_active", "desc")}
                >
                    Active First
                </DropdownMenu.Item>
                <DropdownMenu.Item
                    on:click={() => handleSortChange("is_reachable", "desc")}
                >
                    Reachable First
                </DropdownMenu.Item>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    </div>

    <!-- Error State -->
    {#if error && !isLoading}
        <Card class="p-4 border-destructive">
            <div class="flex items-center justify-between">
                <p class="text-destructive">{error}</p>
                <Button
                    variant="outline"
                    size="sm"
                    on:click={() => serverStore.fetchServers(true)}
                >
                    Retry
                </Button>
            </div>
        </Card>
    {/if}

    <!-- Loading State -->
    {#if isLoading && !hasServers}
        <div class="flex justify-center items-center h-64">
            <div class="flex flex-col items-center gap-4">
                <Loader2 class="w-8 h-8 animate-spin text-muted-foreground" />
                <p class="text-sm text-muted-foreground">Loading servers...</p>
            </div>
        </div>
    {:else if !hasServers && !isLoading}
        <!-- Empty State -->
        <Card class="p-12">
            <div class="text-center space-y-4">
                <div class="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                    <Plus class="w-12 h-12 text-muted-foreground" />
                </div>
                <div>
                    <h3 class="text-lg font-semibold mb-2">No servers found</h3>
                    <p class="text-muted-foreground mb-4">
                        {serverStore.filter.searchQuery || Object.keys(serverStore.filter).length > 0
                            ? "Try adjusting your filters or search query"
                            : "Get started by adding your first server"}
                    </p>
                    <Button
                        variant="outline"
                        on:click={() => {
                            selectedServer = null;
                            showDialog = true;
                        }}
                    >
                        <Plus class="w-4 h-4 mr-2" />
                        Add Your First Server
                    </Button>
                </div>
            </div>
        </Card>
    {:else}
        <!-- Server Grid -->
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

        <!-- Load More Button -->
        {#if serverStore.hasMorePages && !isLoading}
            <div class="flex justify-center">
                <Button
                    variant="outline"
                    on:click={() => serverStore.fetchServers(false)}
                >
                    Load More
                </Button>
            </div>
        {/if}
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

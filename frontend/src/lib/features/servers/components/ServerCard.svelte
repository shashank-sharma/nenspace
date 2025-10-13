<script lang="ts">
    import {
        Server as ServerIcon,
        Trash2,
        Terminal,
        Wifi,
        WifiOff,
        Edit,
        ExternalLink,
    } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import { Switch } from "$lib/components/ui/switch";
    import {
        Card,
        CardHeader,
        CardTitle,
        CardDescription,
        CardContent,
        CardFooter,
    } from "$lib/components/ui/card";
    import type { Server } from "../types";

    let { server, onEdit, onDelete, onToggleStatus, onSSH } = $props<{
        server: Server;
        onEdit: (server: Server) => void;
        onDelete: (id: string) => void;
        onToggleStatus: (id: string, status: boolean) => void;
        onSSH: (server: Server) => void;
    }>();

    const serverDetailUrl = `/dashboard/servers/${server.id}`;

    function handleCardClick(e: Event) {
        const target = e.target as HTMLElement;
        if (target.closest(".action-button")) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    function handleEdit(e: Event) {
        e.preventDefault();
        e.stopPropagation();
        onEdit(server);
    }

    function handleSSH(e: Event) {
        e.preventDefault();
        e.stopPropagation();
        onSSH(server);
    }

    function handleDelete(e: Event) {
        e.preventDefault();
        e.stopPropagation();
        onDelete(server.id);
    }

    function formatDate(date: string) {
        return new Date(date).toLocaleString();
    }
</script>

<!-- Use an anchor tag for native browser navigation -->
<a href={serverDetailUrl} class="block no-underline text-inherit">
    <Card
        class="cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden"
        on:click={handleCardClick}
    >
        <div
            class="absolute inset-0 bg-primary/5 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none"
        >
            <div
                class="bg-background/80 px-3 py-2 rounded-full flex items-center gap-2 shadow-sm"
            >
                <ExternalLink class="w-4 h-4" />
                <span class="text-sm font-medium">View Details</span>
            </div>
        </div>

        <CardHeader>
            <CardTitle class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <ServerIcon class="w-4 h-4" />
                    <span>{server.name}</span>
                </div>
                <Badge variant={server.is_active ? "default" : "secondary"}>
                    {server.is_active ? "Active" : "Disabled"}
                </Badge>
            </CardTitle>
            <CardDescription class="flex items-center gap-2">
                <span>{server.ip}</span>
                {#if server.is_reachable}
                    <Badge
                        variant="outline"
                        class="flex gap-1 bg-green-50 text-green-700 border-green-200"
                    >
                        <Wifi class="w-3 h-3" />
                        <span>Reachable</span>
                    </Badge>
                {:else}
                    <Badge
                        variant="outline"
                        class="flex gap-1 bg-gray-50 text-gray-500 border-gray-200"
                    >
                        <WifiOff class="w-3 h-3" />
                        <span>Unreachable</span>
                    </Badge>
                {/if}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div class="space-y-2">
                <div class="text-sm">
                    <span class="font-medium">Provider:</span>
                    {server.provider}
                </div>
                <div class="text-sm">
                    <span class="font-medium">Created:</span>
                    {formatDate(server.created)}
                </div>
                {#if server.ssh_enabled}
                    <div class="flex gap-1 items-center">
                        <Badge variant="outline" class="flex gap-1">
                            <Terminal class="w-3 h-3" />
                            <span>SSH {server.ip}:{server.port}</span>
                        </Badge>
                    </div>
                {/if}
            </div>
        </CardContent>
        <CardFooter class="justify-between">
            <div class="flex items-center gap-2 action-button">
                <Switch
                    checked={server.is_active}
                    onCheckedChange={() =>
                        onToggleStatus(server.id, !server.is_active)}
                />
                <span class="text-sm">
                    {server.is_active ? "Active" : "Disabled"}
                </span>
            </div>
            <div class="flex gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    class="action-button"
                    title="Edit server"
                    on:click={handleEdit}
                >
                    <Edit class="w-4 h-4" />
                </Button>
                {#if server.ssh_enabled}
                    <Button
                        variant="outline"
                        size="icon"
                        class="action-button"
                        disabled={!server.is_active || !server.is_reachable}
                        title={!server.is_reachable
                            ? "Server is unreachable"
                            : "Connect via SSH"}
                        on:click={handleSSH}
                    >
                        <Terminal class="w-4 h-4" />
                    </Button>
                {/if}
                <Button
                    variant="destructive"
                    size="icon"
                    class="action-button"
                    on:click={handleDelete}
                >
                    <Trash2 class="w-4 h-4" />
                </Button>
            </div>
        </CardFooter>
    </Card>
</a>

<style>
    a:hover {
        text-decoration: none;
    }
</style>

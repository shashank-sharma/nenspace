<script lang="ts">
    import {
        Server as ServerIcon,
        Trash2,
        Terminal,
        Wifi,
        WifiOff,
        Edit,
        ExternalLink,
        Power,
        PowerOff,
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
    import { cn } from "$lib/utils";
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
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }
</script>

<!-- Use an anchor tag for native browser navigation -->
<a href={serverDetailUrl} class="block no-underline text-inherit">
    <Card
        class={cn(
            "cursor-pointer hover:shadow-lg transition-all duration-200 relative overflow-hidden",
            !server.is_active && "opacity-75",
            server.is_reachable && server.is_active && "border-green-500/20"
        )}
        on:click={handleCardClick}
    >
        <div
            class="absolute inset-0 bg-primary/5 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none"
        >
            <div
                class="bg-background/90 px-3 py-2 rounded-full flex items-center gap-2 shadow-lg border"
            >
                <ExternalLink class="w-4 h-4" />
                <span class="text-sm font-medium">View Details</span>
            </div>
        </div>

        <CardHeader class="pb-3">
            <CardTitle class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <ServerIcon class={cn(
                        "w-5 h-5",
                        server.is_active ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span class="line-clamp-1">{server.name}</span>
                </div>
                <Badge 
                    variant={server.is_active ? "default" : "secondary"}
                    class={cn(
                        server.is_active && "bg-green-600 hover:bg-green-700 text-white",
                        !server.is_active && "bg-muted text-muted-foreground"
                    )}
                >
                    {server.is_active ? "Active" : "Disabled"}
                </Badge>
            </CardTitle>
            <CardDescription class="flex items-center gap-2 flex-wrap">
                <span class="font-mono text-sm">{server.ip}</span>
                {#if server.is_reachable}
                    <Badge
                        variant="outline"
                        class="flex gap-1 items-center bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                    >
                        <Wifi class="w-3 h-3" />
                        <span>Reachable</span>
                    </Badge>
                {:else}
                    <Badge
                        variant="outline"
                        class="flex gap-1 items-center bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800"
                    >
                        <WifiOff class="w-3 h-3" />
                        <span>Unreachable</span>
                    </Badge>
                {/if}
            </CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
            <div class="space-y-2 text-sm">
                <div class="flex items-center justify-between">
                    <span class="text-muted-foreground">Provider:</span>
                    <span class="font-medium">{server.provider || "N/A"}</span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-muted-foreground">Created:</span>
                    <span class="font-medium">{formatDate(server.created)}</span>
                </div>
                {#if server.ssh_enabled}
                    <div class="flex items-center justify-between">
                        <span class="text-muted-foreground">SSH:</span>
                        <Badge variant="outline" class="flex gap-1 items-center">
                            <Terminal class="w-3 h-3" />
                            <span class="font-mono text-xs">{server.ip}:{server.port}</span>
                        </Badge>
                    </div>
                {/if}
            </div>
        </CardContent>
        <CardFooter class="justify-between pt-3 border-t">
            <div class="flex items-center gap-2 action-button">
                <Switch
                    checked={server.is_active}
                    onCheckedChange={() =>
                        onToggleStatus(server.id, server.is_active)}
                    class="action-button"
                />
                <span class="text-xs text-muted-foreground">
                    {server.is_active ? "Active" : "Inactive"}
                </span>
            </div>
            <div class="flex gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    class="action-button h-8 w-8"
                    title="Edit server"
                    on:click={handleEdit}
                >
                    <Edit class="h-4 w-4" />
                </Button>
                {#if server.ssh_enabled}
                    <Button
                        variant="outline"
                        size="icon"
                        class="action-button h-8 w-8"
                        disabled={!server.is_active || !server.is_reachable}
                        title={!server.is_reachable
                            ? "Server is unreachable"
                            : !server.is_active
                            ? "Server is inactive"
                            : "Connect via SSH"}
                        on:click={handleSSH}
                    >
                        <Terminal class="h-4 w-4" />
                    </Button>
                {/if}
                <Button
                    variant="destructive"
                    size="icon"
                    class="action-button h-8 w-8"
                    title="Delete server"
                    on:click={handleDelete}
                >
                    <Trash2 class="h-4 w-4" />
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
